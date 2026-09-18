import {describeOperation} from './operation-discovery.js';

const brandDocument = 'Brand guidance: use green.\n';

function operationStep(id, title, name, input, key, expectedFields, extra = {}) {
  const definition = describeOperation(name);
  if (!definition?.mcp.available) throw new Error(`Recipe operation is not an agent tool: ${name}`);
  const operation = {name, input, ...(key ? {key} : {})};
  const args = ['call', name, '--input', JSON.stringify(input), ...(key ? ['--key', key] : [])];
  return {
    id, title, operation, cli: {args},
    mcp: {name: definition.mcp.name, arguments: definition.effect === 'write' ? {input, key} : input},
    expected: {cli: expectedFields, mcp: expectedFields}, ...extra,
  };
}

export const agentRecipes = [
  {
    id: 'sign-in', title: 'Connect an agent to your workspace',
    description: 'Use your verified email and approve the device code in the browser. Create a workspace only if your business needs a new one; otherwise list and select your existing workspace.',
    permissions: 'An agent inherits the person who approves its device code. It cannot approve its own identity through MCP.',
    denials: [{id: 'agent-approval', code: 'forbidden', when: 'An agent session tries to approve a device authorization. A browser session must approve it.'}],
    steps: [
      {id: 'login', title: 'Sign in and approve the displayed code', cli: {args: ['login', '--agent', 'Operations assistant']}, browserApproval: true, expected: {cli: ['person.id', 'session.id', 'session.kind']}, note: 'Open verificationUri, verify your email, and approve the matching userCode. Wait for the final success result. Never give an agent your email proof or session token.'},
      operationStep('create-workspace', 'Create a workspace for this example', 'workspaces.create', {name: 'Example Company', slug: 'example-company'}, 'example-company-create-v1', ['workspace.id', 'membership.role'], {cli: {args: ['workspace', 'create', 'Example Company', '--slug', 'example-company', '--key', 'example-company-create-v1']}, save: {'workspace-id': 'workspace.id'}}),
      operationStep('list-workspaces', 'List your workspaces', 'workspaces.list', {}, null, ['workspaces'], {cli: {args: ['workspace', 'list']}}),
      operationStep('select-workspace', 'Select the workspace in this CLI', 'workspaces.get', {workspaceId: '<workspace-id>'}, null, ['workspace.id', 'membership.role'], {cli: {args: ['workspace', 'use', '<workspace-id>']}, note: 'The CLI saves this selection. The MCP form inspects the workspace; scope the MCP server with --workspace to select it for tools.'}),
    ],
  },
  {
    id: 'deploy-share', title: 'Deploy Inventory and share it privately',
    description: 'Create the supplied Inventory app, deploy it into the selected workspace, and invite one exact email address. Run deployment from the generated app directory.',
    permissions: 'Any current member can create an app and becomes its maintainer. Only a workspace owner or admin can invite external guests. A guest invitation does not grant workspace membership or Library access.',
    denials: [
      {id: 'member-sharing', code: 'forbidden', when: 'An ordinary member tries to invite an external guest, even when that member can open the app.'},
      {id: 'wrong-email', code: 'invitation_email_mismatch', when: 'Someone signed in with another email tries to accept the invitation.'},
      {id: 'guest-other-app', code: 'forbidden', when: 'The accepted guest tries to open a different app that was not shared with them.'},
    ],
    steps: [
      {id: 'create-app', title: 'Create the Inventory checkout', cli: {args: ['new', 'recipe-inventory', '--template', 'inventory']}, expected: {cli: ['directory', 'name']}, save: {'app-directory': 'directory'}, note: 'Local app creation and builds run through the CLI. There is no MCP tool that reads and builds your local source directory.'},
      {id: 'deploy', title: 'Deploy from the app directory', cli: {args: ['deploy', '--workspace', '<workspace-id>'], cwd: '<app-directory>'}, expected: {cli: ['appId', 'releaseId', 'deploymentId', 'url', 'state']}, save: {'app-id': 'appId', 'release-id': 'releaseId', 'app-url': 'url'}, note: 'Deployment saves its artifact and step keys before remote changes. Rerun this command to resume an interrupted attempt.'},
      operationStep('share', 'Invite a guest to this app and its stock list', 'apps.guests.invite', {appId: '<app-id>', email: 'guest@example.com', actionNames: ['stock.list']}, 'inventory-guest-v1', ['invitation.id', 'invitation.status'], {cli: {args: ['share', 'guest@example.com', '--app', '<app-id>', '--actions', 'stock.list', '--key', 'inventory-guest-v1']}, expected: {cli: ['appId', 'url', 'invitation.id', 'audience.publicWeb', 'workspaceAccessRemainsInEffect'], mcp: ['invitation.id', 'invitation.status']}, save: {'guest-invitation-id': 'invitation.id'}, note: 'The recipient opens the invitation email, signs in with guest@example.com, and accepts it in the browser. Another email cannot accept it. Workspace access remains in effect; this command does not make the app public. For a guest-only request, inspect the published actions and grant every action the app UI needs. Read apps.access.get, then set apps.access.set to audience selected with an empty personIds list and the observed revision. Read apps.guests.list, revoke every other active guest, cancel every pending invitation for another email, and unpublish public web access if enabled. Read the sharing state again before reporting success: publicWeb must be false, selected workspace people must be empty, there must be no other active guest, and there must be no pending invitation for another email. Maintainers retain management authority without live app access.'}),
    ],
  },
  {
    id: 'actions', title: 'Discover and call permitted app actions',
    description: 'Inspect the deployed Inventory actions and their schemas before calling them. The reservation uses orderId as its business key.',
    permissions: 'App access and the named action permission are checked on every call. An explicitly denied action fails through both CLI and MCP, even if the person can open the app.',
    denials: [{id: 'action-denied', code: 'forbidden', when: 'The current person is explicitly denied the named action. CLI and MCP return the same denial.'}],
    steps: [
      operationStep('discover-actions', 'Discover current action schemas', 'actions.list', {appId: '<app-id>'}, null, ['appId', 'releaseId', 'actions']),
      operationStep('read-stock', 'Read available stock', 'actions.call', {appId: '<app-id>', actionName: 'stock.list', input: {}}, 'inventory-read-v1', ['result.items', 'invocationId'], {note: 'stock.list is a read. The platform actions.call tool is conservatively classified as a write, so its MCP wrapper still requires a key.'}),
      operationStep('reserve-stock', 'Reserve one unit exactly once', 'actions.call', {appId: '<app-id>', actionName: 'stock.reserve', input: {orderId: 'recipe-order-1', sku: 'paper-a4', quantity: 1}}, 'recipe-order-1', ['result.orderId', 'result.status', 'invocationId'], {note: 'Retry the identical input and key to receive the original reservation. A different order is a new intent and needs its own orderId and key.'}),
    ],
  },
  {
    id: 'library', title: 'Contribute and correct company knowledge',
    description: 'Upload a source document, find it, create guidance, and explicitly correct that guidance from the revision you observed.',
    permissions: 'Current workspace members and their agents can contribute. Selected item audiences and source permissions still apply. External guests cannot read Library. A removed member or revoked session fails on the next call.',
    denials: [
      {id: 'guest-library', code: 'forbidden', when: 'An external guest tries to search the workspace Library.'},
      {id: 'revoked-session', code: 'unauthorized', when: 'The saved agent session is revoked. The next CLI or MCP operation fails.'},
    ],
    files: [{path: 'brand.md', content: brandDocument}],
    steps: [
      operationStep('upload-file', 'Upload the brand document', 'library.file.upload', {workspaceId: '<workspace-id>', filename: 'brand.md', contentType: 'text/markdown', contentBase64: btoa(brandDocument)}, 'brand-upload-v1', ['item.id', 'revision.id', 'revision.file.sha256'], {cli: {args: ['library', 'upload', './brand.md', '--workspace', '<workspace-id>', '--key', 'brand-upload-v1']}, save: {'file-item-id': 'item.id'}}),
      operationStep('search-library', 'Find accessible brand guidance', 'library.search', {workspaceId: '<workspace-id>', query: 'brand'}, null, ['items'], {cli: {args: ['library', 'search', 'brand', '--workspace', '<workspace-id>']}}),
      operationStep('read-file', 'Read the saved source and its revision', 'library.get', {workspaceId: '<workspace-id>', itemId: '<file-item-id>'}, null, ['item.id', 'revision.id'], {cli: {args: ['library', 'get', '<file-item-id>', '--workspace', '<workspace-id>']}}),
      operationStep('create-knowledge', 'Save explicit company guidance', 'library.entry.create', {workspaceId: '<workspace-id>', title: 'Brand preference', text: 'Use green for the company brand.'}, 'brand-entry-v1', ['item.id', 'revision.id', 'revision.author.personId'], {save: {'knowledge-item-id': 'item.id', 'knowledge-revision-id': 'revision.id'}}),
      operationStep('correct-knowledge', 'Correct the observed revision', 'library.entry.revise', {workspaceId: '<workspace-id>', itemId: '<knowledge-item-id>', baseRevisionId: '<knowledge-revision-id>', text: 'Use forest green for the company brand.', reason: 'The team specified the shade.'}, 'brand-entry-v2', ['item.id', 'revision.id', 'revision.number'], {note: 'If another correction wins first, revision_conflict includes currentRevisionId. Read the current guidance before making a new correction; do not reuse the old key with changed input.'}),
    ],
  },
].map(recipe => ({...recipe, steps: recipe.steps.map(step => ({...step, cli: {...step.cli, args: [...step.cli.args, '--json']}}))}));

const quote = value => /^[a-zA-Z0-9_./:@=-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
export function recipeCommand(step) {
  return ['atrax', ...step.cli.args].map(quote).join(' ');
}

export function renderRecipe(recipe) {
  const lines = [`## ${recipe.title}`, '', recipe.description, '', recipe.permissions, ''];
  for (const denial of recipe.denials ?? []) lines.push(`Expected denial: \`${denial.code}\`. ${denial.when}`, '');
  for (const file of recipe.files ?? []) lines.push(`Create \`${file.path}\` with this content:`, '', '```text', file.content.trimEnd(), '```', '');
  for (const step of recipe.steps) {
    lines.push(`### ${step.title}`, '');
    if (step.cli.cwd) lines.push(`Run from \`${step.cli.cwd}\`.`, '');
    lines.push('```sh', recipeCommand(step), '```', '', `Expected CLI result fields: ${step.expected.cli.map(field => `\`${field}\``).join(', ')}.`, '');
    if (step.save) lines.push(`Use ${Object.entries(step.save).map(([name, field]) => `\`${field}\` as \`<${name}>\``).join(', ')}.`, '');
    if (step.note) lines.push(step.note, '');
    if (step.mcp) lines.push('Equivalent MCP tool call:', '', '```json', JSON.stringify(step.mcp, null, 2), '```', '', `Expected MCP structuredContent fields: ${step.expected.mcp.map(field => `\`${field}\``).join(', ')}.`, '');
  }
  return lines.join('\n');
}

export function renderRecipeGuide() {
  return `# Run Atrax workflows with an existing agent

Agents act with the signed-in person's current permissions. Hosted agents and independently authorized unattended agents are outside this launch.

Inspect the installed operation contract without a website or sign-in:

\`\`\`sh
atrax operations list --json
atrax operations inspect library.entry.revise --json
atrax recipes list --json
atrax recipes show library --json
\`\`\`

Discovery includes all registry operations, their input schemas, effects, authentication, scope, MCP availability, and retry-key expectations. Scope describes the resource identified by the input; the server resolves its current permissions. Identity proof and browser approval operations are listed but excluded from MCP.

Run these examples in order, or supply the identifiers from your existing workspace and app. Replace angle-bracket placeholders with saved result values. CLI commands return the standard envelope; field paths below start at its \`result\`. MCP calls return those fields in \`structuredContent\`. An MCP error has \`isError: true\` and \`structuredContent.error.code\`.

Connect the saved agent session over stdio after browser approval:

\`\`\`sh
atrax mcp --workspace <workspace-id>
\`\`\`

Choose stable keys before writes and keep them with the input. See [Retry a CLI write](cli-writes.md). The CLI's absent-key default creates a fresh key; MCP requires an explicit key for each write. A key never grants permission.

${agentRecipes.map(renderRecipe).join('\n')}
## Verify locally

\`\`\`sh
node scripts/generate-agent-recipes.mjs --check
node --test tests/agent-recipes.test.mjs
\`\`\`

The tests execute these examples against the local control-plane Worker, D1, R2, gateway, app runtime, and MCP stdio transport. Email goes only to the local mailbox using example.com addresses. The external Cloudflare provisioning API is simulated; these checks do not claim a live deployment.
`;
}
