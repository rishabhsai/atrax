import { GatewayError } from './validation.js';

export const AUTH_CALLBACK_PATH = '/__atrax/auth/callback';
const APP_COOKIE = '__Host-atrax_app';
const LOGIN_COOKIE = '__Host-atrax_app_login';
const STATE_PATTERN = /^[a-f0-9]{64}$/;

function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function consoleOrigin(env) {
  if (typeof env.CONSOLE_ORIGIN !== 'string') {
    throw new GatewayError('gateway_misconfigured', 500, 'CONSOLE_ORIGIN is required');
  }
  let url;
  try {
    url = new URL(env.CONSOLE_ORIGIN);
  } catch {
    throw new GatewayError('gateway_misconfigured', 500, 'CONSOLE_ORIGIN must be a valid HTTPS origin');
  }
  if (url.protocol !== 'https:' || url.href !== `${url.origin}/`) {
    throw new GatewayError('gateway_misconfigured', 500, 'CONSOLE_ORIGIN must be a valid HTTPS origin');
  }
  return url.origin;
}

function safeReturnPath(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value) || value.length > 2048) return null;
  const resolved = new URL(value, origin);
  if (resolved.origin !== origin || `${resolved.pathname}${resolved.search}` !== value) return null;
  return value;
}

function cookieValue(request) {
  const header = request.headers.get('cookie') ?? '';
  const match = new RegExp(`(?:^|;\\s*)${LOGIN_COOKIE}=([^;]+)(?:;|$)`).exec(header);
  return match?.[1] ?? null;
}

function encodeLoginCookie(state, returnPath) {
  const encodedPath = btoa(returnPath).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${state}.${encodedPath}`;
}

function decodeLoginCookie(request) {
  const value = cookieValue(request);
  const match = /^([a-f0-9]{64})\.([A-Za-z0-9_-]+)$/.exec(value ?? '');
  if (!match) throw new GatewayError('login_state_missing', 400, 'App sign-in state is missing or invalid');
  let returnPath;
  try {
    const encoded = match[2].replaceAll('-', '+').replaceAll('_', '/');
    returnPath = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
  } catch {
    throw new GatewayError('login_state_invalid', 400, 'App sign-in state is invalid');
  }
  return { state: match[1], returnPath };
}

function sameState(left, right) {
  if (!STATE_PATTERN.test(left) || !STATE_PATTERN.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < 64; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function denial(result) {
  const error = result?.error;
  if (!error || typeof error.code !== 'string' || !Number.isInteger(error.status) ||
      typeof error.message !== 'string') {
    return new GatewayError('door_contract_error', 502, 'Access returned an invalid app login result');
  }
  return new GatewayError(error.code, error.status, error.message, error.details);
}

export function isBrowserNavigation(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.get('sec-fetch-mode') === 'navigate') return true;
  return request.headers.get('accept')?.split(',').some((type) =>
    ['text/html', 'application/xhtml+xml'].includes(type.split(';', 1)[0].trim().toLowerCase())) ?? false;
}

export function beginAppLogin(request, env) {
  const requestUrl = new URL(request.url);
  const returnPath = safeReturnPath(`${requestUrl.pathname}${requestUrl.search}`, requestUrl.origin) ?? '/';
  const state = randomState();
  const destination = new URL('/auth/app', consoleOrigin(env));
  destination.searchParams.set('appId', env.APP_ID);
  destination.searchParams.set('state', state);
  destination.searchParams.set('hostname', requestUrl.host);
  return new Response(null, {
    status: 302,
    headers: {
      'cache-control': 'private, no-store',
      location: destination.href,
      'set-cookie': `${LOGIN_COOKIE}=${encodeLoginCookie(state, returnPath)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`,
    },
  });
}

export async function completeAppLogin(request, env) {
  const url = new URL(request.url);
  const codes = url.searchParams.getAll('code');
  const states = url.searchParams.getAll('state');
  if (codes.length !== 1 || states.length !== 1 || !/^[a-f0-9]{64}$/.test(codes[0]) ||
      !STATE_PATTERN.test(states[0])) {
    throw new GatewayError('invalid_login_callback', 400, 'App sign-in callback is invalid');
  }
  const saved = decodeLoginCookie(request);
  if (!sameState(saved.state, states[0])) {
    throw new GatewayError('login_state_mismatch', 400, 'App sign-in state does not match');
  }
  const returnPath = safeReturnPath(saved.returnPath, url.origin);
  if (!returnPath) throw new GatewayError('login_return_invalid', 400, 'App sign-in return path is invalid');
  let result;
  try {
    result = await env.DOOR.exchangeAppCode({
      appId: env.APP_ID,
      code: codes[0],
      state: states[0],
      callbackUrl: `${url.origin}${AUTH_CALLBACK_PATH}`,
    });
  } catch {
    throw new GatewayError('door_unavailable', 502, 'App sign-in could not be completed');
  }
  if (!result || result.ok !== true) throw denial(result);
  const session = result.session;
  if (!session || !/^[a-f0-9]{64}$/.test(session.token) ||
      !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= Date.now() ||
      session.expiresAt > 8_640_000_000_000_000) {
    throw new GatewayError('door_contract_error', 502, 'Access returned an invalid app session');
  }
  const headers = new Headers({
    'cache-control': 'private, no-store',
    location: returnPath,
  });
  headers.append('set-cookie', `${APP_COOKIE}=${session.token}; Path=/; Secure; HttpOnly; SameSite=Lax; Expires=${new Date(session.expiresAt).toUTCString()}`);
  headers.append('set-cookie', `${LOGIN_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}
