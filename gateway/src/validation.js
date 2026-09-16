import { Validator } from '@cfworker/json-schema';
import {
  MAX_ARTIFACT_BYTES,
  MAX_ASSET_BYTES,
  validateActionDescriptors,
  validateManifest,
} from '../../shared/app-contract.js';

const MAX_JSON_BYTES = 1024 * 1024;

export class GatewayError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validAssetPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path === '/' ||
      path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return false;
  return path.slice(1).split('/').every((part) => part && part !== '.' && part !== '..');
}

function validateAssets(assets, assetPrefix) {
  if (!object(assets)) throw new Error('config.assets must be an object');
  if (typeof assetPrefix !== 'string' || !assetPrefix.endsWith('/') ||
      assetPrefix.startsWith('/') || assetPrefix.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(assetPrefix) ||
      assetPrefix.slice(0, -1).split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('config.assetPrefix must be a safe R2 key prefix ending in /');
  }
  for (const [path, asset] of Object.entries(assets)) {
    if (!validAssetPath(path) || !object(asset) ||
        !/^[a-f0-9]{64}$/.test(asset.hash) ||
        typeof asset.contentType !== 'string' || !asset.contentType || asset.contentType.length > 200 ||
        /[\r\n]/.test(asset.contentType) ||
        !Number.isSafeInteger(asset.size) || asset.size < 0 || asset.size > MAX_ASSET_BYTES ||
        Object.keys(asset).some((key) => !['hash', 'contentType', 'size'].includes(key))) {
      throw new Error(`config.assets contains an invalid asset: ${path}`);
    }
  }
}

export async function gatewayConfiguration(env) {
  for (const name of ['APP_ID', 'RELEASE_ID', 'WORKSPACE_ID']) {
    if (typeof env[name] !== 'string' || !env[name]) {
      throw new GatewayError('gateway_misconfigured', 500, `${name} is required`);
    }
  }
  if (!env.ARTIFACTS || typeof env.ARTIFACTS.get !== 'function') {
    throw new GatewayError('gateway_misconfigured', 500, 'ARTIFACTS is required');
  }
  if (typeof env.CONFIG_KEY !== 'string' || !env.CONFIG_KEY || env.CONFIG_KEY.length > 1024 ||
      /[\u0000-\u001f\u007f]/.test(env.CONFIG_KEY)) {
    throw new GatewayError('gateway_misconfigured', 500, 'CONFIG_KEY is required');
  }
  const stored = await env.ARTIFACTS.get(env.CONFIG_KEY);
  if (!stored || stored.size > MAX_ARTIFACT_BYTES) {
    throw new GatewayError('gateway_config_unavailable', 502, 'Gateway configuration is unavailable');
  }
  let value;
  try {
    value = JSON.parse(await stored.text());
    if (!object(value) || Object.keys(value).some((key) =>
      !['manifest', 'actions', 'assets', 'assetPrefix'].includes(key))) {
      throw new Error('Gateway config has an invalid shape');
    }
    const manifest = validateManifest(value.manifest);
    const actions = validateActionDescriptors(value.actions);
    validateAssets(value.assets, value.assetPrefix);
    if (manifest.web?.fallback && !Object.hasOwn(value.assets, `/${manifest.web.fallback}`)) {
      throw new Error('config assets do not contain web.fallback');
    }
    return { manifest, actions, assets: value.assets, assetPrefix: value.assetPrefix };
  } catch (error) {
    throw new GatewayError('gateway_misconfigured', 500, error.message);
  }
}

export function actionDescriptor(descriptors, name) {
  return descriptors.find((descriptor) => descriptor.name === name) ?? null;
}

export function runtimeDescriptors(value) {
  try {
    return validateActionDescriptors(value);
  } catch (error) {
    throw new GatewayError('invalid_runtime_descriptors', 502, `Runtime descriptors are invalid: ${error.message}`);
  }
}

export async function readJson(request) {
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (type !== 'application/json') {
    throw new GatewayError('invalid_content_type', 415, 'Action input must use application/json');
  }
  const declaredSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_JSON_BYTES) {
    throw new GatewayError('input_too_large', 413, 'Action input exceeds 1 MiB');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new GatewayError('input_too_large', 413, 'Action input exceeds 1 MiB');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GatewayError('invalid_json', 400, 'Action input must be valid JSON');
  }
}

export function validateSchema(schema, value, code, label) {
  let result;
  try {
    result = new Validator(schema, '7', false).validate(value);
  } catch (error) {
    throw new GatewayError('gateway_misconfigured', 500, `${label} schema is invalid: ${error.message}`);
  }
  if (!result.valid) {
    throw new GatewayError(code, code === 'invalid_action_input' ? 400 : 502, `${label} does not match its schema`, {
      errors: result.errors.map(({ instanceLocation, keyword, keywordLocation, error }) => ({
        instanceLocation,
        keyword,
        keywordLocation,
        message: error,
      })),
    });
  }
}

export function requireJsonValue(value) {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('undefined');
  } catch {
    throw new GatewayError('invalid_action_output', 502, 'Action result must be JSON serializable');
  }
}

export function requestCredential(request) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) throw new GatewayError('invalid_authorization', 401, 'Authorization must use Bearer credentials');
    return { kind: 'bearer', token: match[1] };
  }
  const cookie = request.headers.get('cookie');
  return cookie ? { kind: 'cookie', cookie } : { kind: 'none' };
}

export function requestFacts(request) {
  const url = new URL(request.url);
  return {
    method: request.method,
    origin: request.headers.get('origin'),
    host: url.host,
    csrfToken: request.headers.get('x-atrax-csrf'),
  };
}

export function requireIdempotencyKey(request, descriptor) {
  const key = request.headers.get('idempotency-key');
  if (descriptor.effect === 'write' && !key) {
    throw new GatewayError('idempotency_key_required', 400, 'Write actions require an Idempotency-Key header');
  }
  if (key && (key.length > 200 || /[\u0000-\u001f\u007f]/.test(key))) {
    throw new GatewayError('invalid_idempotency_key', 400, 'Idempotency-Key must be at most 200 printable characters');
  }
  return key;
}

export function delegatedInvocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GatewayError('invalid_delegated_invocation', 400, 'Delegated invocation must be an object');
  }
  const allowed = ['parentInvocationId', 'sourceAppId', 'actionName', 'input', 'idempotencyKey'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new GatewayError('invalid_delegated_invocation', 400, 'Delegated invocation contains an unknown field');
  }
  for (const name of ['parentInvocationId', 'sourceAppId', 'actionName']) {
    if (typeof value[name] !== 'string' || !value[name]) {
      throw new GatewayError('invalid_delegated_invocation', 400, `${name} is required`);
    }
  }
  if (value.idempotencyKey !== null && value.idempotencyKey !== undefined &&
      (typeof value.idempotencyKey !== 'string' || !value.idempotencyKey || value.idempotencyKey.length > 200)) {
    throw new GatewayError('invalid_delegated_invocation', 400, 'idempotencyKey is invalid');
  }
  return value;
}

export function authorizedCall(value, requiresInvocation) {
  if (!value || typeof value !== 'object' || !value.person || !value.session ||
      typeof value.person.id !== 'string' || !value.person.id ||
      typeof value.person.email !== 'string' || !value.person.email ||
      typeof value.session.id !== 'string' || !value.session.id ||
      typeof value.session.kind !== 'string' || !value.session.kind ||
      (value.session.agentLabel !== null && value.session.agentLabel !== undefined && typeof value.session.agentLabel !== 'string') ||
      typeof value.workspaceId !== 'string' || !value.workspaceId ||
      !Number.isInteger(value.depth) || value.depth < 0 ||
      (value.sourceAppId !== null && value.sourceAppId !== undefined &&
        (typeof value.sourceAppId !== 'string' || !value.sourceAppId)) ||
      (value.idempotencyKey !== null && value.idempotencyKey !== undefined &&
        (typeof value.idempotencyKey !== 'string' || !value.idempotencyKey)) ||
      (value.allowedActions !== undefined &&
        (!Array.isArray(value.allowedActions) || value.allowedActions.some((name) => typeof name !== 'string' || !name))) ||
      (requiresInvocation &&
        (typeof value.invocationId !== 'string' || !value.invocationId ||
          typeof value.rootInvocationId !== 'string' || !value.rootInvocationId))) {
    throw new GatewayError('door_contract_error', 502, 'Door returned an invalid authorization result');
  }
  return value;
}

export function errorResponse(error, operationId = null) {
  const known = error instanceof GatewayError;
  const code = known ? error.code : 'internal_error';
  const status = known ? error.status : 500;
  const message = known ? error.message : 'The action could not be completed';
  return Response.json({
    schemaVersion: 1,
    operationId,
    status: 'failed',
    error: {
      code,
      message,
      retryable: status >= 500,
      ...(known && error.details ? { details: error.details } : {}),
    },
  }, { status });
}
