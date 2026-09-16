import {operations} from './operations.js';

// Identity proofs and browser approval stay outside an agent's tool connection.
const identityFlows = new Map([
  ['apps.login', 'The browser completes app sign-in with a navigation state and callback.'],
  ...['auth.email.start', 'auth.email.verify', 'auth.device.start', 'auth.device.get', 'auth.device.approve', 'auth.device.poll']
    .map(name => [name, 'Run atrax login --agent <name>; the person verifies their email and approves the displayed device code in the browser.']),
]);
const keySchema = {type: 'string', minLength: 1, maxLength: 200};

export function toolName(name) {
  return `atrax_${name.replaceAll('.', '_')}`;
}

export function toolSchema(definition) {
  if (definition.effect !== 'write') return definition.inputSchema;
  return {type: 'object', properties: {input: definition.inputSchema, key: keySchema}, required: ['input', 'key'], additionalProperties: false};
}

function scope(name, definition) {
  const properties = definition.inputSchema.properties ?? {};
  for (const [field, kind] of [['workspaceId', 'workspace'], ['appId', 'app'], ['invitationId', 'invitation'], ['sessionId', 'session']]) {
    if (properties[field]) return {kind, inputField: field, resolution: `The server checks current access to the resource identified by ${field}.`};
  }
  return {kind: identityFlows.has(name) ? 'identity_flow' : 'account', inputField: null, resolution: 'The server resolves authority from the current identity or the sign-in proof.'};
}

export function describeOperation(name) {
  const definition = operations[name];
  if (!definition) return null;
  const reason = identityFlows.get(name);
  const write = definition.effect === 'write';
  return {
    name, description: definition.description, effect: definition.effect,
    inputSchema: definition.inputSchema,
    authentication: {required: !definition.anonymous, identity: definition.anonymous ? 'anonymous_identity_flow' : 'current_session', permission: 'Current person, session, membership, and resource permissions are checked by the server.'},
    scope: scope(name, definition),
    agent: {directTool: !reason, ...(reason ? {reason} : {})},
    mcp: reason ? {available: false, reason} : {available: true, name: toolName(name), inputSchema: toolSchema(definition)},
    idempotency: {
      stableKeyForRetry: write && !reason,
      cliOption: write && !reason ? '--key' : null,
      httpHeader: write && !reason ? 'Idempotency-Key' : null,
      mcpKeyRequired: write && !reason,
      description: reason ? 'Complete the documented identity flow; a key does not replace email proof or browser approval.'
        : write ? 'Choose a stable key before writing and reuse it with identical input. CLI calls without --key generate a new key. Replay behavior follows the operation contract; a key does not bypass current permissions.'
          : 'Read operations need no stable key.',
      ...(name === 'actions.call' ? {actionEffect: 'Inspect actions.list for the selected action effect and input schema. The platform call is conservatively classified as a write; MCP requires a key even when the selected action reads.'} : {}),
    },
    ...(definition.maxBodyBytes === undefined ? {} : {maxBodyBytes: definition.maxBodyBytes}),
  };
}

export function listOperations() {
  return Object.keys(operations).sort().map(describeOperation);
}
