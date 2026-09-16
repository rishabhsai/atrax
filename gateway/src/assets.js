import { GatewayError } from './validation.js';

const PRIVATE_HEADERS = {
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
};

function requestPath(request) {
  const encoded = new URL(request.url).pathname;
  if (/%(?:2f|5c)/i.test(encoded)) return null;
  let path;
  try {
    path = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return null;
  const parts = path.slice(1).split('/');
  if (parts.some((part, index) =>
    (part === '' && index !== parts.length - 1) || part === '.' || part === '..')) return null;
  return path;
}

function isHtmlNavigation(request, path) {
  const finalSegment = path.endsWith('/') ? '' : path.slice(path.lastIndexOf('/') + 1);
  if (finalSegment.includes('.')) return false;
  if (request.headers.get('sec-fetch-mode') === 'navigate') return true;
  return request.headers.get('accept')?.split(',').some((type) =>
    ['text/html', 'application/xhtml+xml'].includes(type.split(';', 1)[0].trim().toLowerCase())) ?? false;
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: {
      ...PRIVATE_HEADERS,
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

export async function serveAsset(request, env, configuration) {
  const path = requestPath(request);
  if (!path) return notFound();
  let asset = configuration.assets[path];
  if (!asset && path.endsWith('/')) {
    asset = configuration.assets[`${path}index.html`];
  }
  if (!asset && configuration.manifest.web.fallback && isHtmlNavigation(request, path)) {
    asset = configuration.assets[`/${configuration.manifest.web.fallback}`];
  }
  if (!asset) return notFound();
  const objectBody = await env.ARTIFACTS.get(`${configuration.assetPrefix}${asset.hash}`);
  if (!objectBody || objectBody.size !== asset.size) {
    throw new GatewayError('artifact_asset_unavailable', 502, 'The requested asset is unavailable');
  }
  return new Response(request.method === 'HEAD' ? null : objectBody.body, {
    headers: {
      ...PRIVATE_HEADERS,
      'content-length': String(asset.size),
      'content-type': asset.contentType,
      etag: `"${asset.hash}"`,
    },
  });
}
