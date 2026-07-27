import { CpError } from "./errors.js";

const apiBase = "https://api.cloudflare.com/client/v4";

// Every Cloudflare REST call in the control plane goes through this one
// function so tests can swap it out wholesale with `env.__cfApi`.
//
// `body` is either a JSON-serialisable value or a pre-encoded request built by
// buildScriptUpload(): `{ __contentType, __body }`.
export async function cfApi(env, method, path, body = null) {
  const headers = { authorization: `Bearer ${env.CF_API_TOKEN}` };
  let payload;
  if (body && typeof body === "object" && typeof body.__body === "string") {
    headers["content-type"] = body.__contentType;
    payload = body.__body;
  } else if (body !== null && body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: payload,
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.success === false) {
    const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
    throw new CpError(502, "Cloudflare rejected an instant hosting operation.", {
      status: response.status,
      path,
      code: first?.code ?? null,
      message: first?.message ?? text.slice(0, 300),
    });
  }
  return parsed?.result ?? parsed;
}

export function cfApiFor(env) {
  return typeof env.__cfApi === "function" ? env.__cfApi : cfApi;
}

// Workers script upload is multipart/form-data. Every part here is text (the
// user's modules, the generated shim, and the generated assets module whose
// bytes are base64 string literals), so the body is built as a plain string.
export function buildScriptUpload(metadata, modules) {
  const boundary = `----tarantula${crypto.randomUUID().replaceAll("-", "")}`;
  let body = `--${boundary}\r\n`;
  body += 'content-disposition: form-data; name="metadata"\r\n';
  body += "content-type: application/json\r\n\r\n";
  body += `${JSON.stringify(metadata)}\r\n`;
  for (const [name, source] of Object.entries(modules)) {
    body += `--${boundary}\r\n`;
    body += `content-disposition: form-data; name="${name}"; filename="${name}"\r\n`;
    body += "content-type: application/javascript+module\r\n\r\n";
    body += `${source}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return {
    __contentType: `multipart/form-data; boundary=${boundary}`,
    __body: body,
  };
}
