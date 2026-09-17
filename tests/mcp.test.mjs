import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localMailboxSource,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';

const root = resolve(import.meta.dirname,'..');

async function platform(t) {
  const directory = await mkdtemp(join(tmpdir(),'atrax-mcp-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  const mf = new Miniflare({host:'127.0.0.1',port:0,workers:[
    localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
      CP_DB:{type:'d1',id:'mcp-test-db'},
      LIBRARY_FILES:{type:'r2',name:'mcp-library-files'},
      CONSOLE_ORIGIN:{type:'json',value:'https://console.atrax.test'},
      EMAIL_FROM:{type:'json',value:'test@atrax.test'},
      EMAIL:{type:'worker',worker:'mailbox',exportName:'Mail'},
    }),
    localWorker('mailbox',localMailboxSource),
  ]});
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const tokens = {owner:'a'.repeat(64),member:'b'.repeat(64)};
  const now = Date.now();
  await db.batch([
    ...Object.entries(tokens).flatMap(([person,token]) => [
      db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(person,`${person}@example.com`,now,now),
      db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,agent_label,created_at,expires_at) VALUES(?,?,?,'agent',?,?,?)").bind(`${person}-session`,person,createHash('sha256').update(token).digest('hex'),`${person} MCP`,now,now + 3_600_000),
    ]),
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)").bind(now,now),
  ]);
  const origin = (await mf.ready).origin;
  async function call(name,input,person='owner',key=crypto.randomUUID()) {
    const response = await fetch(`${origin}/v1/operations/${name}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Idempotency-Key':key,Authorization:`Bearer ${tokens[person]}`},
      body:JSON.stringify(input),
    });
    return {status:response.status,body:await response.json()};
  }
  async function mcp(person,workspaceId='company',saved=true) {
    const config = join(directory,`config-${person}-${crypto.randomUUID()}`);
    await mkdir(config,{recursive:true,mode:0o700});
    if (saved) await writeFile(join(config,'credentials.json'),JSON.stringify({origin,accessToken:tokens[person],session:{id:`${person}-session`},person:{id:person}}),{mode:0o600});
    const transport = new StdioClientTransport({
      command:process.execPath,
      args:[join(root,'bin/atrax.mjs'),'mcp','--workspace',workspaceId],
      cwd:root,
      env:{...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:config},
      stderr:'pipe',
    });
    const client = new Client({name:'atrax-mcp-test',version:'1.0.0'});
    await client.connect(transport);
    t.after(() => client.close());
    return client;
  }
  return {db,mf,tokens,call,mcp};
}

function toolResult(result) {
  assert.equal(result.isError,true,JSON.stringify(result));
  return result.structuredContent?.error;
}

test('MCP stdio tools use the registry, persist Library files in R2, and require explicit write keys', {timeout:45_000}, async (t) => {
  const api = await platform(t);
  const client = await api.mcp('owner');
  assert.equal(client.getServerVersion().version,JSON.parse(await readFile(join(root,'package.json'),'utf8')).version);
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  assert.ok(names.has('atrax_library_file_upload'));
  assert.ok(names.has('atrax_library_file_download'));
  assert.ok(names.has('atrax_actions_list'));
  assert.ok(names.has('atrax_actions_call'));
  assert.ok(names.has('atrax_workspaces_transferOwnership'));
  assert.equal(names.has('atrax_workspace_transferOwnership'),false);
  assert.equal(names.has('atrax_auth_device_start'),false);
  assert.equal(names.has('atrax_auth_email_verify'),false);
  assert.equal(names.has('atrax_apps_login'),false);
  const retiredOperation = await api.call('workspace.transferOwnership',{workspaceId:'company',personId:'member'});
  assert.equal(retiredOperation.status,404);
  assert.equal(retiredOperation.body.error.code,'not_found');

  const member = await api.mcp('member');
  const unauthorizedTransfer = await member.callTool({name:'atrax_workspaces_transferOwnership',arguments:{
    input:{workspaceId:'company',personId:'owner'},key:'member-transfer-v1',
  }});
  assert.equal(toolResult(unauthorizedTransfer).code,'forbidden');
  const transfer = await client.callTool({name:'atrax_workspaces_transferOwnership',arguments:{
    input:{workspaceId:'company',personId:'member'},key:'owner-transfer-v1',
  }});
  assert.equal(transfer.isError,undefined);
  assert.equal(transfer.structuredContent.ownerPersonId,'member');
  const roles = await api.db.prepare("SELECT person_id, role FROM workspace_members WHERE workspace_id='company' ORDER BY person_id").all();
  assert.deepEqual(roles.results,[{person_id:'member',role:'owner'},{person_id:'owner',role:'admin'}]);

  const bytes = Buffer.from('All shipments need a signed receipt.');
  const missingKey = await client.callTool({name:'atrax_library_file_upload',arguments:{input:{workspaceId:'company',filename:'shipping.txt',contentType:'text/plain',contentBase64:bytes.toString('base64')}}});
  assert.equal(missingKey.isError,true);

  const uploaded = await client.callTool({name:'atrax_library_file_upload',arguments:{
    input:{workspaceId:'company',filename:'shipping.txt',contentType:'text/plain',contentBase64:bytes.toString('base64')},
    key:'mcp-upload-shipping-v1',
  }});
  assert.equal(uploaded.isError,undefined);
  assert.equal(uploaded.structuredContent.revision.author.kind,'agent');
  assert.equal(uploaded.structuredContent.revision.author.agentLabel,'owner MCP');
  const itemId = uploaded.structuredContent.item.id;
  const revisionId = uploaded.structuredContent.revision.id;
  const objectKey = (await api.db.prepare('SELECT object_key FROM library_file_versions WHERE revision_id=?').bind(revisionId).first()).object_key;
  const bucket = await api.mf.getR2Bucket('LIBRARY_FILES','control-plane');
  assert.equal(await (await bucket.get(objectKey)).text(),bytes.toString());

  const downloaded = await client.callTool({name:'atrax_library_file_download',arguments:{workspaceId:'company',itemId}});
  assert.equal(downloaded.isError,undefined);
  assert.equal(downloaded.structuredContent.contentBase64,bytes.toString('base64'));
  const scope = await client.callTool({name:'atrax_library_list',arguments:{workspaceId:'another-company'}});
  assert.equal(toolResult(scope).code,'workspace_scope_violation');
});

test('MCP applies current Library permissions and session revocation to every call', {timeout:45_000}, async (t) => {
  const api = await platform(t);
  const owner = await api.mcp('owner');
  const created = await owner.callTool({name:'atrax_library_entry_create',arguments:{
    input:{workspaceId:'company',title:'Operations policy',text:'Members may read this before the policy changes.'},
    key:'mcp-create-policy-v1',
  }});
  assert.equal(created.isError,undefined);
  const itemId = created.structuredContent.item.id;
  const member = await api.mcp('member');
  const before = await member.callTool({name:'atrax_library_get',arguments:{workspaceId:'company',itemId}});
  assert.equal(before.isError,undefined);
  const restricted = await owner.callTool({name:'atrax_library_setAccess',arguments:{
    input:{workspaceId:'company',itemId,audience:'selected',personIds:['owner']},
    key:'mcp-restrict-policy-v1',
  }});
  assert.equal(restricted.isError,undefined);
  const denied = await member.callTool({name:'atrax_library_get',arguments:{workspaceId:'company',itemId}});
  assert.equal(toolResult(denied).code,'not_found');

  await api.db.prepare("UPDATE sessions SET revoked_at=? WHERE session_id='owner-session'").bind(Date.now()).run();
  const revoked = await owner.callTool({name:'atrax_library_list',arguments:{workspaceId:'company'}});
  assert.equal(toolResult(revoked).code,'unauthorized');
});

test('MCP starts without a saved sign-in but returns a structured sign-in instruction', {timeout:45_000}, async (t) => {
  const api = await platform(t);
  const client = await api.mcp('owner','company',false);
  const result = await client.callTool({name:'atrax_library_list',arguments:{workspaceId:'company'}});
  assert.equal(toolResult(result).code,'login_required');
  assert.match(toolResult(result).message,/atrax login/);
});
