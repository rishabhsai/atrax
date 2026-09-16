import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {Validator} from '@cfworker/json-schema';
import {operations} from '../shared/operations.js';
import {describeOperation, listOperations} from '../shared/operation-discovery.js';
import {agentRecipes, renderRecipeGuide} from '../shared/agent-recipes.js';
import {recipePlatform, cliResult, httpResult, toolResult} from './helpers/recipes-platform.mjs';
import {packagedCli} from './helpers/package-cli.mjs';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const denialCode = (recipe, id) => agentRecipes.find(value => value.id === recipe).denials.find(value => value.id === id).code;
function expectFields(result, fields) {
  for (const field of fields) assert.notEqual(valueAt(result, field), undefined, `Missing documented result field ${field}: ${JSON.stringify(result)}`);
}
function materialize(value, variables) {
  if (typeof value === 'string') return value.replace(/<([a-z-]+)>/g, (_, name) => {
    assert.notEqual(variables[name], undefined, `Recipe needs <${name}>`);
    return variables[name];
  });
  if (Array.isArray(value)) return value.map(item => materialize(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materialize(item, variables)]));
  return value;
}
function expectCliError(outcome, code) {
  assert.equal(outcome.code, 1, outcome.stdout + outcome.stderr);
  assert.equal(outcome.envelope.error.code, code, outcome.stdout);
}
function expectToolError(outcome, code) {
  assert.equal(outcome.isError, true, JSON.stringify(outcome));
  assert.equal(outcome.structuredContent.error.code, code, JSON.stringify(outcome));
}

test('installed CLI discovers the complete registry offline and renders the same recipes as the checked guide', {timeout: 60_000}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'atrax-discovery-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const cli = (await packagedCli(t)).executable;
  const run = async args => JSON.parse((await execute(process.execPath, [cli, ...args, '--json'], {cwd: directory, env: {...process.env, ATRAX_CONFIG_DIR: join(directory, 'no-login'), ATRAX_API_ORIGIN: 'http://127.0.0.1:1'}, maxBuffer: 4 * 1024 * 1024})).stdout).result;
  const listed = (await run(['operations', 'list'])).operations;
  assert.deepEqual(listed, listOperations());
  assert.deepEqual(listed.map(item => item.name), Object.keys(operations).sort());
  for (const operation of listed) {
    const registered = operations[operation.name];
    assert.deepEqual(operation.inputSchema, registered.inputSchema);
    assert.equal(operation.effect, registered.effect);
    assert.equal(operation.authentication.required, !registered.anonymous);
    assert.equal(operation.mcp.available, operation.agent.directTool);
    if (operation.scope.inputField) assert.ok(registered.inputSchema.properties[operation.scope.inputField]);
  }
  const revised = (await run(['operations', 'inspect', 'library.entry.revise'])).operation;
  assert.deepEqual(revised, describeOperation('library.entry.revise'));
  assert.equal(revised.idempotency.mcpKeyRequired, true);
  assert.equal(revised.scope.kind, 'workspace');
  for (const name of ['apps.login', 'auth.email.verify', 'auth.device.approve']) {
    const operation = listed.find(item => item.name === name);
    assert.equal(operation.mcp.available, false);
    assert.ok(operation.agent.reason);
  }
  assert.equal(listed.find(item => item.name === 'actions.list').scope.kind, 'app');
  assert.equal(listed.find(item => item.name === 'apps.guests.accept').scope.kind, 'invitation');
  assert.equal(listed.find(item => item.name === 'library.search').idempotency.stableKeyForRetry, false);
  assert.deepEqual((await run(['recipes', 'list'])).recipes.map(recipe => recipe.id), agentRecipes.map(recipe => recipe.id));
  for (const recipe of agentRecipes) assert.deepEqual((await run(['recipes', 'show', recipe.id])).recipe, recipe);
  const human = await execute(process.execPath, [cli, 'operations', 'list'], {cwd: directory});
  assert.match(human.stdout, /library.entry.revise\s+write\s+workspace\s+available/);
  assert.match(human.stdout, /auth.device.approve.*identity flow/);
  await assert.rejects(execute(process.execPath, [cli, 'operations', 'inspect', 'not.registered', '--json'], {cwd: directory}), error => JSON.parse(error.stdout).error.code === 'operation_not_found');
  assert.equal(await readFile(join(root, 'docs/agent-recipes.md'), 'utf8'), renderRecipeGuide(), 'Regenerate docs from the executable recipe source');
});

test('recipes execute browser-approved identity, deployment, sharing, actions, and Library through the real platform and MCP', {timeout: 240_000}, async t => {
  const api = await recipePlatform(t);
  await api.signIn('owner');
  const variables = {};
  let ownerMcp;
  const results = new Map();
  let descriptors;

  for (const recipe of agentRecipes) {
    for (const file of recipe.files ?? []) await writeFile(join(api.directory, file.path), file.content);
    for (const step of recipe.steps) {
      await t.test(`${recipe.id}: ${step.id}`, async () => {
        const cli = materialize(step.cli, variables);
        const before = api.calls.length;
        const result = cliResult(await api.run('owner', cli.args, {cwd: cli.cwd ?? api.directory, approve: !!step.browserApproval}));
        expectFields(result, step.expected.cli);
        results.set(step.id, result);
        if (step.browserApproval) {
          assert.equal(result.session.kind, 'agent');
          assert.equal(result.session.agentLabel, 'Operations assistant');
          assert.ok(api.calls.slice(before).some(call => call.name === 'auth.device.approve' && call.status === 200));
        }
        if (step.operation) {
          ownerMcp ??= await api.mcp('owner', result.workspace?.id ?? variables['workspace-id']);
          const operation = materialize(step.operation, variables);
          const executed = api.calls.slice(before).find(call => call.name === operation.name);
          assert.ok(executed, `CLI did not invoke ${operation.name}`);
          assert.deepEqual(executed.input, operation.input, 'Human command and machine input must describe the same request');
          if (operation.key) assert.equal(executed.key, operation.key);
          const schema = operations[operation.name].inputSchema;
          const checked = new Validator(schema, '7').validate(operation.input);
          assert.equal(checked.valid, true, JSON.stringify(checked.errors));
          const mcp = materialize(step.mcp, variables);
          const mirrored = toolResult(await ownerMcp.callTool(mcp));
          expectFields(mirrored, step.expected.mcp);
          if (operation.name === 'actions.list') descriptors = result.actions;
          if (operation.name === 'actions.call') {
            const descriptor = descriptors.find(action => action.name === operation.input.actionName);
            assert.ok(descriptor);
            assert.equal(new Validator(descriptor.inputSchema, '7').validate(operation.input.input).valid, true);
            assert.deepEqual(mirrored.result, result.result);
          }
          if (result.item) assert.equal(mirrored.item.id, result.item.id);
          if (result.revision) assert.equal(mirrored.revision.id, result.revision.id);
          if (result.invitation) assert.equal(mirrored.invitation.id, result.invitation.id);
        }
        for (const [name, field] of Object.entries(step.save ?? {})) variables[name] = valueAt(result, field);
      });
    }
  }

  await t.test('registry inventory and actual MCP tools cannot silently diverge', async () => {
    const listed = await ownerMcp.listTools();
    const expected = listOperations().filter(operation => operation.mcp.available);
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), expected.map(operation => operation.mcp.name).sort());
    for (const recipe of agentRecipes) for (const step of recipe.steps.filter(step => step.mcp)) {
      const tool = listed.tools.find(tool => tool.name === step.mcp.name);
      const checked = new Validator(tool.inputSchema, '7').validate(materialize(step.mcp.arguments, variables));
      assert.equal(checked.valid, true, `${step.id}: ${JSON.stringify(checked.errors)}`);
    }
    for (const name of Object.keys(operations)) {
      const response = await api.call(name, {});
      assert.notEqual(response.body.error?.code, 'not_found', `${name} is registered but unavailable at HTTP`);
      assert.ok([400, 401].includes(response.status), `${name}: ${JSON.stringify(response.body)}`);
    }
    const device = httpResult(await api.call('auth.device.start', {clientName: 'Browser approval check'}));
    expectCliError(await api.run('owner', ['call', 'auth.device.approve', '--input', JSON.stringify({userCode: device.userCode, decision: 'approve'})]), denialCode('sign-in', 'agent-approval'));
  });

  await t.test('repeated write recipes preserve file revisions and stock', async () => {
    const app = api.apps.get(variables['app-id']);
    const live = await api.mf.getD1Database(app.liveBinding, 'control-plane');
    const candidate = await api.mf.getD1Database(app.releases.get(variables['release-id']).candidateBinding, 'control-plane');
    assert.equal((await live.prepare("SELECT available FROM stock WHERE sku='paper-a4'").first()).available, 9);
    assert.equal((await live.prepare('SELECT COUNT(*) count FROM reservations').first()).count, 1);
    assert.equal((await candidate.prepare("SELECT available FROM stock WHERE sku='paper-a4'").first()).available, 10);
    const reserve = agentRecipes.find(recipe => recipe.id === 'actions').steps.find(step => step.id === 'reserve-stock');
    const repeated = cliResult(await api.run('owner', materialize(reserve.cli.args, variables)));
    assert.deepEqual(repeated.result, results.get('reserve-stock').result);
    assert.equal((await live.prepare("SELECT available FROM stock WHERE sku='paper-a4'").first()).available, 9);
    assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM library_items').first()).count, 2);
    assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM library_revisions').first()).count, 3);
    const files = await api.mf.getR2Bucket('LIBRARY_FILES', 'control-plane');
    const objects = await files.list();
    assert.equal(objects.objects.length, 1);
    assert.equal(await (await files.get(objects.objects[0].key)).text(), agentRecipes.find(recipe => recipe.id === 'library').files[0].content);
    assert.equal(results.get('correct-knowledge').revision.number, 2);
    assert.equal((await api.credentials('owner')).workspaceId, variables['workspace-id']);
  });

  await t.test('ordinary member agents cannot manage external guests and action denials apply to CLI and MCP', async () => {
    await api.signIn('member');
    const invitation = httpResult(await api.call('members.invite', {workspaceId: variables['workspace-id'], email: 'member@example.com', role: 'member'}, 'owner'));
    httpResult(await api.call('members.accept', {invitationId: invitation.invitation.id}, 'member'));
    cliResult(await api.run('member', ['login', '--agent', 'Member assistant'], {approve: true}));
    const memberMcp = await api.mcp('member', variables['workspace-id']);
    const share = agentRecipes.find(recipe => recipe.id === 'deploy-share').steps.find(step => step.id === 'share');
    expectCliError(await api.run('member', materialize(share.cli.args, variables)), denialCode('deploy-share', 'member-sharing'));
    expectToolError(await memberMcp.callTool(materialize(share.mcp, variables)), denialCode('deploy-share', 'member-sharing'));
    const read = agentRecipes.find(recipe => recipe.id === 'actions').steps.find(step => step.id === 'read-stock');
    cliResult(await api.run('member', materialize(read.cli.args, variables)));
    toolResult(await memberMcp.callTool(materialize(read.mcp, variables)));
    const {access} = httpResult(await api.call('actions.access.get', {appId: variables['app-id'], actionName: 'stock.list'}, 'owner'));
    httpResult(await api.call('actions.access.set', {appId: variables['app-id'], actionName: 'stock.list', audience: 'workspace', personIds: [], deniedPersonIds: [api.people.member.person.id], expectedRevision: access.revision}, 'owner'));
    expectCliError(await api.run('member', materialize(read.cli.args, variables)), denialCode('actions', 'action-denied'));
    expectToolError(await memberMcp.callTool(materialize(read.mcp, variables)), denialCode('actions', 'action-denied'));
    const discover = toolResult(await memberMcp.callTool({name: 'atrax_actions_list', arguments: {appId: variables['app-id']}}));
    assert.equal(discover.actions.some(action => action.name === 'stock.list'), false);
  });

  await t.test('an exact-email guest opens the shared app but cannot read Library or another app', async () => {
    await api.signIn('guest');
    const invitationId = variables['guest-invitation-id'];
    const wrong = await api.call('apps.guests.accept', {invitationId}, 'member');
    assert.equal(wrong.body.error.code, denialCode('deploy-share', 'wrong-email'));
    httpResult(await api.call('apps.guests.accept', {invitationId}, 'guest'));
    const opened = await api.openApp('guest', variables['app-id']);
    assert.equal(opened.status, 200, JSON.stringify(opened));
    cliResult(await api.run('guest', ['login', '--agent', 'Guest assistant'], {approve: true}));
    const guestMcp = await api.mcp('guest');
    const read = agentRecipes.find(recipe => recipe.id === 'actions').steps.find(step => step.id === 'read-stock');
    cliResult(await api.run('guest', materialize(read.cli.args, variables)));
    toolResult(await guestMcp.callTool(materialize(read.mcp, variables)));
    const search = agentRecipes.find(recipe => recipe.id === 'library').steps.find(step => step.id === 'search-library');
    expectCliError(await api.run('guest', materialize(search.cli.args, variables)), denialCode('library', 'guest-library'));
    expectToolError(await guestMcp.callTool(materialize(search.mcp, variables)), denialCode('library', 'guest-library'));
    const second = cliResult(await api.run('owner', ['new', 'private-recipe-app', '--template', 'static']));
    const deployed = cliResult(await api.run('owner', ['deploy', '--workspace', variables['workspace-id']], {cwd: second.directory}));
    assert.equal((await api.openApp('guest', deployed.appId)).status, 403);
    expectCliError(await api.run('guest', ['call', 'apps.get', '--input', JSON.stringify({appId: deployed.appId})]), denialCode('deploy-share', 'guest-other-app'));
    expectToolError(await guestMcp.callTool({name: 'atrax_apps_get', arguments: {appId: deployed.appId}}), denialCode('deploy-share', 'guest-other-app'));
    assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM workspace_members WHERE person_id=?').bind(api.people.guest.person.id).first()).count, 0);
  });

  await t.test('revocation blocks the next CLI and MCP request and all email stays in the local sink', async () => {
    const saved = await api.credentials('owner');
    httpResult(await api.call('auth.session.revoke', {sessionId: saved.session.id}, 'owner'));
    const search = agentRecipes.find(recipe => recipe.id === 'library').steps.find(step => step.id === 'search-library');
    expectCliError(await api.run('owner', materialize(search.cli.args, variables)), denialCode('library', 'revoked-session'));
    expectToolError(await ownerMcp.callTool(materialize(search.mcp, variables)), denialCode('library', 'revoked-session'));
    const messages = await api.mailbox();
    assert.ok(messages.length >= 5, 'Observe sign-in and invitation email in the local sink');
    assert.ok(messages.every(message => message.to.endsWith('@example.com')));
    assert.equal(api.provider.calls.every(call => call.path.startsWith('/accounts/') || call.path.startsWith('/zones/')), true);
  });
});
