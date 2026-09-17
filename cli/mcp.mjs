import {fromJsonSchema, McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {readFile} from 'node:fs/promises';
import {operations} from '../shared/operations.js';
import {describeOperation,toolName,toolSchema} from '../shared/operation-discovery.js';
import {operation as callOperation, readCredentials} from './client.mjs';

export {toolName} from '../shared/operation-discovery.js';

function errorResult(error) {
  const value = {
    error:{
      code:error?.code ?? 'operation_failed',
      message:error?.message ?? 'The Atrax operation could not finish.',
      ...(error?.details === undefined ? {} : {details:error.details}),
    },
  };
  return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:true};
}

function successResult(result) {
  return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};
}

function scopeError(message) {
  const error = new Error(message);
  error.code = 'workspace_scope_violation';
  return error;
}

async function enforceWorkspaceScope(operationName,input,workspaceId,invoke) {
  if (!workspaceId) return;
  if (input?.workspaceId !== undefined && input.workspaceId !== workspaceId) {
    throw scopeError(`This MCP server is scoped to workspace ${workspaceId}.`);
  }
  if (typeof input?.appId !== 'string') return;
  const app = await invoke('apps.get',{appId:input.appId});
  if (app?.app?.workspaceId !== workspaceId) {
    throw scopeError(`App ${input.appId} is outside this MCP server's workspace scope.`);
  }
  // `apps.get` itself has no workspaceId. Its response is the authoritative
  // association used before forwarding every app-scoped platform operation.
  if (operationName === 'apps.get') return;
}

async function createServer({workspaceId,invoke,credentials,errorStream}) {
  const {version} = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const server = new McpServer({name:'atrax',version}, {
    instructions:'Use the shared Atrax operation tools. Supply a stable, explicit key for every write and reuse it only when retrying the same request.',
  });
  for (const [operationName,definition] of Object.entries(operations)) {
    if (!describeOperation(operationName).mcp.available) continue;
    server.registerTool(toolName(operationName), {
      title:operationName,
      description:definition.description,
      inputSchema:fromJsonSchema(toolSchema(definition)),
      annotations:{readOnlyHint:definition.effect === 'read',destructiveHint:false,idempotentHint:definition.effect === 'read'},
    }, async (arguments_) => {
      if (!credentials) {
        return errorResult(Object.assign(new Error('Sign in with `atrax login --agent "<name>"` before starting this MCP server.'),{code:'login_required'}));
      }
      const input = definition.effect === 'write' ? arguments_.input : arguments_;
      const key = definition.effect === 'write' ? arguments_.key : undefined;
      try {
        await enforceWorkspaceScope(operationName,input,workspaceId,invoke);
        return successResult(await invoke(operationName,input,key === undefined ? {} : {key}));
      } catch (error) {
        return errorResult(error);
      }
    });
  }
  if (!credentials) {
    errorStream.write('Atrax MCP needs a saved sign-in. Run `atrax login --agent "<name>"` before starting it.\n');
  }
  return server;
}

/**
 * Serve Atrax tools over stdio. This function intentionally owns stdout: the
 * MCP transport is the only protocol written there.
 */
export async function serveMcp(options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const errorStream = options.error ?? process.stderr;
  const credentials = options.credentials === undefined ? await (options.readCredentials ?? readCredentials)() : options.credentials;
  const invoke = options.operation ?? callOperation;
  const server = await createServer({workspaceId:options.workspaceId,invoke,credentials,errorStream});
  const transport = new StdioServerTransport(input,output);
  transport.onerror = (error) => errorStream.write(`Atrax MCP transport error: ${error.message}\n`);
  await server.connect(transport);
  return {server,transport};
}
