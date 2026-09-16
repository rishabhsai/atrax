import { WorkerEntrypoint } from 'cloudflare:workers';
import { canonicalJson } from '../../shared/app-contract.js';
import {rpcResult,unwrapRpc} from '../../shared/rpc-result.js';
import { ActionContext } from './action-context.js';
import {
  AUTH_CALLBACK_PATH,
  beginAppLogin,
  completeAppLogin,
  isBrowserNavigation,
} from './app-login.js';
import { serveAsset } from './assets.js';
import {
  GatewayError,
  actionDescriptor,
  authorizedCall,
  delegatedInvocation,
  errorResponse,
  gatewayConfiguration,
  readJson,
  requestCredential,
  requestFacts,
  requireIdempotencyKey,
  requireJsonValue,
  runtimeDescriptors,
  validateSchema,
} from './validation.js';

const ACTIONS_PATH = '/__atrax/actions';
const HEALTH_PATH = '/__atrax/health';

function normalizeError(error, fallbackCode = 'internal_error', fallbackStatus = 500) {
  if (error instanceof GatewayError) return error;
  if (error && typeof error.code === 'string' && Number.isInteger(error.status)) {
    return new GatewayError(error.code, error.status, error.message, error.details);
  }
  return new GatewayError(fallbackCode, fallbackStatus,
    fallbackStatus === 403 ? 'Access denied' : 'The action could not be completed');
}

function callerDescription(authorization) {
  return {
    person: authorization.person,
    session: authorization.session,
    workspaceId: authorization.workspaceId,
    idempotencyKey: authorization.idempotencyKey ?? null,
    chain: {
      invocationId: authorization.invocationId,
      rootInvocationId: authorization.rootInvocationId,
      depth: authorization.depth,
      sourceAppId: authorization.sourceAppId ?? null,
    },
  };
}

async function authorize(env, input, requiresInvocation) {
  let result;
  try {
    result = await env.DOOR.authorize(input);
  } catch (error) {
    throw normalizeError(error, 'door_unavailable', 502);
  }
  if (!result || result.ok !== true) {
    const denied = result?.error;
    if (!denied || typeof denied.code !== 'string' || !Number.isInteger(denied.status) || typeof denied.message !== 'string') {
      throw new GatewayError('door_contract_error', 502, 'Door returned an invalid denial');
    }
    throw new GatewayError(denied.code, denied.status, denied.message, denied.details);
  }
  if(result.authorization?.public===true) {
    if(input.publicAsset!==true||input.actionName!==null||requiresInvocation||result.authorization.workspaceId!==env.WORKSPACE_ID) throw new GatewayError('door_contract_error',502,'Door returned an invalid public asset grant');
    return result.authorization;
  }
  let authorization;
  try {
    authorization = authorizedCall(result.authorization, requiresInvocation);
  } catch (error) {
    if (requiresInvocation && typeof result.authorization?.invocationId === 'string') {
      await finish(env, result.authorization.invocationId, 'failed', 'door_contract_error');
    }
    throw error;
  }
  if (authorization.workspaceId !== env.WORKSPACE_ID) {
    if (requiresInvocation) {
      await finish(env, authorization.invocationId, 'failed', 'door_contract_error');
    }
    throw new GatewayError('door_contract_error', 502, 'Door authorized the wrong workspace');
  }
  const expectedIdempotencyKey = input.idempotencyKey ?? null;
  if (requiresInvocation && (authorization.idempotencyKey ?? null) !== expectedIdempotencyKey) {
    await finish(env, authorization.invocationId, 'failed', 'door_contract_error');
    throw new GatewayError('door_contract_error', 502, 'Door returned the wrong idempotency key');
  }
  return authorization;
}

async function finish(env, invocationId, outcome, errorCode) {
  try {
    await env.DOOR.finishInvocation({
      invocationId,
      outcome,
      ...(errorCode ? { errorCode } : {}),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'invocation_finish_failed', 502);
    normalized.operationId = invocationId;
    throw normalized;
  }
}

async function runAction(env, configuration, descriptor, input, authorization, expectedSourceAppId = null) {
  const context = new ActionContext(env, configuration.manifest, authorization);
  let outcome = 'failed';
  let errorCode;
  try {
    if (expectedSourceAppId !== null && authorization.sourceAppId !== expectedSourceAppId) {
      throw new GatewayError('door_contract_error', 502, 'Door authorized the wrong source app');
    }
    const result = unwrapRpc(await env.RUNTIME.invoke(
      descriptor.name,
      input,
      context,
      callerDescription(authorization),
    ));
    requireJsonValue(result);
    validateSchema(descriptor.outputSchema, result, 'invalid_action_output', 'Action output');
    outcome = 'succeeded';
    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    errorCode = normalized.code;
    normalized.operationId = authorization.invocationId;
    throw normalized;
  } finally {
    context.close();
    await finish(env, authorization.invocationId, outcome, errorCode);
  }
}

async function authorizeHttp(request, env, actionName, idempotencyKey, requirements = {}) {
  return authorize(env, {
    kind: 'http',
    credential: requestCredential(request),
    request: requestFacts(request),
    appId: env.APP_ID,
    releaseId: env.RELEASE_ID,
    actionName,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...requirements,
  }, actionName !== null);
}

async function descriptorHash(descriptors) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(descriptors)),
  );
  return Array.from(new Uint8Array(bytes),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function handleHealth(request, env) {
  await authorizeHttp(request, env, null, null, { requireMaintenance: true });
  const descriptors = runtimeDescriptors(env.RUNTIME ? await env.RUNTIME.describe() : []);
  return Response.json({
    appId: env.APP_ID,
    releaseId: env.RELEASE_ID,
    descriptorHash: await descriptorHash(descriptors),
  }, { headers: { 'cache-control': 'private, no-store' } });
}

async function handleDiscovery(request, env, configuration) {
  const authorization = await authorizeHttp(request, env, null, null);
  if (!Array.isArray(authorization.allowedActions)) {
    throw new GatewayError('door_contract_error', 502, 'Door did not return allowedActions for discovery');
  }
  const allowed = new Set(authorization.allowedActions);
  return Response.json({
    schemaVersion: 1,
    appId: env.APP_ID,
    releaseId: env.RELEASE_ID,
    actions: configuration.actions
      .filter(({ name }) => allowed.has(name))
      .map((descriptor) => ({
        ...descriptor,
        route: `${ACTIONS_PATH}/${encodeURIComponent(descriptor.name)}`,
      })),
  });
}

async function handleAction(request, env, configuration, actionName) {
  const input = await readJson(request);
  const descriptor = actionDescriptor(configuration.actions, actionName);
  if (!descriptor) throw new GatewayError('action_not_found', 404, 'Unknown action');
  const idempotencyKey = requireIdempotencyKey(request, descriptor);
  validateSchema(descriptor.inputSchema, input, 'invalid_action_input', 'Action input');
  const authorization = await authorizeHttp(
    request,
    env,
    actionName,
    idempotencyKey,
  );
  const result = await runAction(env, configuration, descriptor, input, authorization);
  return Response.json({
    schemaVersion: 1,
    operationId: authorization.invocationId,
    status: 'succeeded',
    result,
  });
}

async function dispatch(request, env) {
  const configuration = await gatewayConfiguration(env);
  const url = new URL(request.url);
  if (url.pathname === AUTH_CALLBACK_PATH) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    return completeAppLogin(request, env);
  }
  if (url.pathname === HEALTH_PATH) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    return handleHealth(request, env);
  }
  if (url.pathname === ACTIONS_PATH) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    return handleDiscovery(request, env, configuration);
  }
  if (url.pathname.startsWith(`${ACTIONS_PATH}/`)) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    let actionName;
    try {
      actionName = decodeURIComponent(url.pathname.slice(ACTIONS_PATH.length + 1));
    } catch {
      throw new GatewayError('action_not_found', 404, 'Unknown action');
    }
    if (!actionName || actionName.includes('/')) throw new GatewayError('action_not_found', 404, 'Unknown action');
    return handleAction(request, env, configuration, actionName);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new GatewayError('route_not_found', 404, 'Unknown route');
  }
  if (!configuration.manifest.web) {
    throw new GatewayError('route_not_found', 404, 'Unknown route');
  }
  try {
    await authorizeHttp(request, env, null, null, {publicAsset:true});
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401 && isBrowserNavigation(request)) {
      return beginAppLogin(request, env);
    }
    throw error;
  }
  return serveAsset(request, env, configuration);
}

/** Public HTTP entrypoint. Customer code is reachable only through RUNTIME RPC. */
export default class Gateway extends WorkerEntrypoint {
  async fetch(request) {
    try {
      return await dispatch(request, this.env);
    } catch (error) {
      const normalized = normalizeError(error);
      return errorResponse(normalized, normalized.operationId ?? null);
    }
  }
}

/** Private entrypoint bound by gateways for explicitly declared dependencies. */
export class TargetGateway extends WorkerEntrypoint {
  async invoke(value) {
    return rpcResult(()=>this.#invoke(value));
  }
  async #invoke(value) {
    const request = delegatedInvocation(value);
    const configuration = await gatewayConfiguration(this.env);
    const descriptor = actionDescriptor(configuration.actions, request.actionName);
    if (!descriptor) throw new GatewayError('action_not_found', 404, 'Unknown action');
    if (descriptor.effect === 'write' && !request.idempotencyKey) {
      throw new GatewayError('idempotency_key_required', 400, 'Write actions require an idempotency key');
    }
    validateSchema(descriptor.inputSchema, request.input, 'invalid_action_input', 'Action input');
    const authorization = await authorize(this.env, {
      kind: 'child',
      parentInvocationId: request.parentInvocationId,
      sourceAppId: request.sourceAppId,
      appId: this.env.APP_ID,
      releaseId: this.env.RELEASE_ID,
      actionName: request.actionName,
      ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
    }, true);
    return runAction(this.env, configuration, descriptor, request.input, authorization, request.sourceAppId);
  }
}
