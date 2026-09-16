const API = "https://api.cloudflare.com/client/v4";
import {COMPATIBILITY_DATE} from '../../shared/app-contract.js';
const STUB = 'export default { fetch() { return new Response("Not found", { status: 404 }); } };';
const VARIABLES = new Set(["APP_ID", "RELEASE_ID", "WORKSPACE_ID", "CONFIG_KEY", "CONSOLE_ORIGIN"]);

export class ProviderError extends Error {
  constructor(code, message, { status = 0, retryable = false, uncertain = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.uncertain = uncertain;
  }
}

function invalid(message) {
  throw new ProviderError("provider_input_invalid", message);
}

function identifier(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid(`Invalid ${label}.`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sortedBindings(bindings) {
  return bindings.map((binding) => {
    if (binding.type === "d1") {
      // Version resources include database_id alongside the upload API's id.
      // Compare resource identity, never provider response-only metadata.
      if (binding.id !== undefined && binding.database_id !== undefined && binding.id !== binding.database_id) throw new ProviderError("provider_binding_conflict", "Cloudflare returned conflicting database binding identifiers.");
      return canonical({ type: binding.type, name: binding.name, id: binding.id ?? binding.database_id });
    }
    return canonical(binding.type === "service" ? { environment: "production", ...binding } : binding);
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function validateBindings(bindings) {
  if (!Array.isArray(bindings)) invalid("Worker bindings must be an array.");
  const names = new Set();
  for (const binding of bindings) {
    if (!binding || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.name) || names.has(binding.name)) invalid("Invalid or duplicate binding name.");
    names.add(binding.name);
    let allowed;
    switch (binding.type) {
      case "plain_text":
        allowed = ["type", "name", "text"];
        if (!VARIABLES.has(binding.name) || typeof binding.text !== "string" || new TextEncoder().encode(binding.text).length > 5000) invalid("Unsupported or oversized Worker variable.");
        break;
      case "service":
        allowed = ["type", "name", "service", "environment", "entrypoint"];
        identifier(binding.service, "service binding");
        if (binding.environment !== undefined && binding.environment !== "production") invalid("Only production service bindings are supported.");
        if (binding.entrypoint !== undefined) identifier(binding.entrypoint, "service entrypoint");
        break;
      case "r2_bucket":
        allowed = ["type", "name", "bucket_name"];
        identifier(binding.bucket_name, "R2 bucket");
        break;
      case "d1":
        allowed = ["type", "name", "id"];
        identifier(binding.id, "D1 binding");
        break;
      default:
        invalid("Unsupported Worker binding type.");
    }
    if (Object.keys(binding).some((key) => !allowed.includes(key))) invalid("Unexpected Worker binding field.");
  }
  return sortedBindings(bindings);
}

function protocolError(uncertain = false) {
  return new ProviderError("provider_response_invalid", "Cloudflare returned an invalid response.", { retryable: true, uncertain });
}

// The coordinator owns retries. This adapter never replays an uncertain SQL batch.
export class CloudflareProvider {
  #token;
  #account;
  #zone;
  #fetch;
  #timeoutMs;

  constructor(env, { fetch: fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
    if (typeof env.CF_API_TOKEN !== "string" || !env.CF_API_TOKEN) invalid("Cloudflare API token is not configured.");
    this.#token = env.CF_API_TOKEN;
    this.#account = identifier(env.CP_ACCOUNT_ID, "Cloudflare account ID");
    this.#zone = identifier(env.CP_ZONE_ID, "Cloudflare zone ID");
    if (typeof fetchImpl !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) invalid("Invalid provider transport configuration.");
    this.#fetch = (input, init) => fetchImpl(input, init);
    this.#timeoutMs = timeoutMs;
  }

  #accountPath(path) { return `/accounts/${this.#account}${path}`; }
  #scriptPath(name) { return this.#accountPath(`/workers/scripts/${identifier(name, "Worker name")}`); }

  async #observeAfterMutation(observe) {
    try { return await observe(); }
    catch (error) {
      if (error instanceof ProviderError) {
        error.uncertain = true;
        error.retryable = true;
      }
      throw error;
    }
  }

  async #request(method, path, body, { missing = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    const mutation = method !== "GET";
    let status = null;
    let codes = [];
    const headers = { authorization: `Bearer ${this.#token}` };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    try {
      const response = await this.#fetch(`${API}${path}`, { method, headers, body: payload, signal: controller.signal });
      status = response.status;
      if (missing && response.status === 404) {
        await response.body?.cancel();
        return null;
      }
      if (method === "DELETE" && response.status === 204) return { success: true };
      let data;
      try {
        if (method === "DELETE" && response.ok) {
          const content = await response.text();
          if (content.length === 0) return { success: true };
          data = JSON.parse(content);
        } else data = await response.json();
      }
      catch { throw protocolError(mutation); }
      if (Array.isArray(data?.errors)) codes = data.errors.map(error => error?.code).filter(code => Number.isSafeInteger(code) && code >= 0).slice(0, 16);
      if (!response.ok || data?.success === false) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new ProviderError("provider_rejected", "Cloudflare rejected the operation.", {
          status: response.status, retryable, uncertain: mutation && response.status >= 500,
        });
      }
      if (data?.success !== true || (method !== "DELETE" && !("result" in data))) throw protocolError(mutation);
      return data;
    } catch (error) {
      // Operator diagnostics deliberately exclude provider prose, bodies,
      // credentials, query strings, and transport exception messages.
      console.error("atrax.provider.request_failed", { method, pathname: path.split("?")[0], status, codes });
      if (error instanceof ProviderError) throw error;
      // Transport errors can include URLs, request bodies, or credentials. Do not expose them.
      throw new ProviderError(controller.signal.aborted ? "provider_timeout" : "provider_unavailable", "Cloudflare did not return a complete response.", { retryable: true, uncertain: mutation });
    } finally { clearTimeout(timer); }
  }

  async #databasesNamed(name) {
    for (let page = 1; ; page++) {
      const data = await this.#request("GET", this.#accountPath(`/d1/database?${new URLSearchParams({ name, page: String(page), per_page: "100" })}`));
      if (!Array.isArray(data.result)) throw protocolError();
      const matches = data.result.filter((database) => database.name === name);
      if (matches.length > 1) throw new ProviderError("provider_resource_conflict", "Multiple databases have the expected name.");
      if (matches.length) return this.#database(matches[0], name);
      if (data.result_info?.total_pages !== undefined ? page >= data.result_info.total_pages : data.result.length < 100) return null;
    }
  }

  #database(database, name) {
    if (typeof database?.uuid !== "string" || database.name !== name) throw protocolError(true);
    return { id: database.uuid, name };
  }

  async ensureDatabase(name) {
    identifier(name, "database name");
    const existing = await this.#databasesNamed(name);
    if (existing) return existing;
    try {
      const { result } = await this.#request("POST", this.#accountPath("/d1/database"), { name });
      return this.#database(result, name);
    } catch (error) {
      // Name uniqueness also resolves a create race or a committed request whose response was lost.
      if (!(error instanceof ProviderError) || (!error.uncertain && error.status !== 409 && error.status !== 400)) throw error;
      const observed = await this.#observeAfterMutation(() => this.#databasesNamed(name));
      if (observed) return observed;
      throw error;
    }
  }

  async queryDatabase(id, statements) {
    identifier(id, "database ID");
    if (!Array.isArray(statements) || !statements.length) invalid("A database batch must contain statements.");
    const batch = statements.map((statement) => {
      if (!statement || typeof statement.sql !== "string" || !statement.sql.trim() || (statement.params !== undefined && !Array.isArray(statement.params))) invalid("Invalid database statement.");
      return statement.params === undefined ? { sql: statement.sql } : { sql: statement.sql, params: statement.params };
    });
    // The REST query API accepts {batch}; D1 batches roll back the whole sequence on failure.
    // https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
    // https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
    const { result } = await this.#request("POST", this.#accountPath(`/d1/database/${id}/query`), { batch });
    if (!Array.isArray(result) || result.length !== batch.length) throw protocolError(true);
    if (result.some((query) => query?.success !== true)) throw new ProviderError("provider_query_failed", "Cloudflare rejected the database batch.");
    return result;
  }

  // Polling export holds D1 queries while producing a consistent SQL snapshot.
  async exportDatabase(id,bookmark) {
    const body={output_format:'polling'};
    if(bookmark) body.current_bookmark=bookmark;
    const {result}=await this.#request('POST',this.#accountPath(`/d1/database/${identifier(id,'database ID')}/export`),body);
    if(result?.status==='error'||result?.success===false) throw new ProviderError('provider_export_failed','Cloudflare could not export the database.',{retryable:true});
    if(typeof result?.at_bookmark!=='string') throw protocolError(true);
    if(result.status==='complete'&&typeof result.result?.signed_url!=='string') throw protocolError(true);
    return {bookmark:result.at_bookmark,complete:result.status==='complete',url:result.result?.signed_url};
  }

  async importDatabase(id,step) {
    const {result}=await this.#request('POST',this.#accountPath(`/d1/database/${identifier(id,'database ID')}/import`),step);
    if(result?.status==='error'||result?.success===false) throw new ProviderError('provider_import_failed','Cloudflare could not import the snapshot.',{retryable:true});
    if(step.action==='init') {
      if(typeof result?.filename!=='string'||(result.upload_url!==undefined&&typeof result.upload_url!=='string')) throw protocolError(true);
      return {filename:result.filename,url:result.upload_url};
    }
    if(result?.status!=='complete'&&typeof result?.at_bookmark!=='string') throw protocolError(true);
    return {bookmark:result.at_bookmark,complete:result.status==='complete'};
  }

  // Signed transfer URLs are provider-returned capabilities. Never send API credentials.
  async transferSnapshot(url,{body,etag}={}) {
    let parsed;try {parsed=new URL(url);} catch {invalid('Invalid snapshot transfer URL.');}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password) invalid('Invalid snapshot transfer URL.');
    try {
      const response=await this.#fetch(parsed.href,{method:body?'PUT':'GET',body,redirect:'manual',signal:AbortSignal.timeout(this.#timeoutMs)});
      if(!response.ok) {await response.body?.cancel();throw new ProviderError('provider_transfer_failed','Snapshot transfer failed.',{retryable:true});}
      if(body&&etag&&response.headers.get('etag')?.replaceAll('"','')!==etag) {await response.body?.cancel();throw new ProviderError('provider_transfer_checksum','Snapshot upload checksum did not match.');}
      return response;
    } catch(error) {
      if(error instanceof ProviderError) throw error;
      throw new ProviderError('provider_transfer_failed','Snapshot transfer did not finish.',{retryable:true});
    }
  }

  async inspectWorker(name) {
    const path = this.#scriptPath(name);
    const settings = await this.#request("GET", `${path}/settings`, undefined, { missing: true });
    if (!settings) return null;
    const deployment = (await this.#request("GET", `${path}/deployments`)).result?.deployments?.[0];
    if (!deployment || deployment.versions?.length !== 1 || deployment.versions[0].percentage !== 100) {
      throw new ProviderError("provider_deployment_conflict", "Worker must have one active version receiving all traffic.");
    }
    const versionId = deployment.versions[0].version_id;
    const version = (await this.#request("GET", `${path}/versions/${identifier(versionId, "Worker version ID")}`)).result;
    const subdomain = (await this.#request("GET", `${path}/subdomain`)).result;
    const bindings = version?.resources?.bindings ?? [];
    const tags = settings.result?.tags ?? [];
    if (version?.id !== versionId || !Array.isArray(bindings) || !Array.isArray(tags) || typeof subdomain?.enabled !== "boolean" || typeof subdomain?.previews_enabled !== "boolean") throw protocolError();
    return { name, versionId, bindings: sortedBindings(bindings), workersDev: subdomain.enabled, previewsEnabled: subdomain.previews_enabled, tags };
  }

  async #upload(name, source, bindings, tags) {
    const form = new FormData();
    form.set("metadata", new Blob([JSON.stringify({ main_module: "worker.js", compatibility_date: COMPATIBILITY_DATE, compatibility_flags: ["nodejs_compat"], bindings, tags })], { type: "application/json" }));
    form.set("worker.js", new Blob([source], { type: "application/javascript+module" }), "worker.js");
    await this.#request("PUT", this.#scriptPath(name), form);
  }

  async #tags(source, bindings, kind, releaseId) {
    identifier(releaseId, "release ID");
    if (typeof source !== "string" || !source.trim()) invalid("Worker source must be nonempty text.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([source, sortedBindings(bindings)])));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return ["atrax-managed", `atrax-kind:${kind}`, `atrax-release:${releaseId}`, `atrax-content:${hash}`];
  }

  #matches(worker, tags, bindings) {
    return worker && tags.every((tag) => worker.tags.includes(tag)) && JSON.stringify(sortedBindings(worker.bindings)) === JSON.stringify(sortedBindings(bindings));
  }

  async #publish({ name, source, bindings, tags }) {
    try { await this.#upload(name, source, bindings, tags); }
    catch (error) {
      if (!(error instanceof ProviderError) || !error.uncertain) throw error;
      const observed = await this.#observeAfterMutation(() => this.inspectWorker(name));
      if (this.#matches(observed, tags, bindings)) return observed;
      throw error;
    }
    const observed = await this.#observeAfterMutation(() => this.inspectWorker(name));
    if (!this.#matches(observed, tags, bindings)) throw new ProviderError("provider_not_converged", "Worker publication has not been observed yet.", { retryable: true, uncertain: true });
    return observed;
  }

  async #disablePublicUrls(name) {
    const path = this.#scriptPath(name);
    try { await this.#request("POST", `${path}/subdomain`, { enabled: false, previews_enabled: false }); }
    catch (error) {
      if (!(error instanceof ProviderError) || !error.uncertain) throw error;
      const { result } = await this.#observeAfterMutation(() => this.#request("GET", `${path}/subdomain`));
      if (result?.enabled === false && result?.previews_enabled === false) return;
      throw error;
    }
    const { result } = await this.#observeAfterMutation(() => this.#request("GET", `${path}/subdomain`));
    if (result?.enabled !== false || result?.previews_enabled !== false) throw new ProviderError("provider_privacy_unverified", "Worker public URLs are not disabled.", { retryable: true, uncertain: true });
  }

  async #checkRuntimeRoutes(name) {
    const domains = (await this.#request("GET", this.#accountPath(`/workers/domains?${new URLSearchParams({ service: name })}`))).result;
    const routes = (await this.#request("GET", `/zones/${this.#zone}/workers/routes`)).result;
    if (!Array.isArray(domains) || !Array.isArray(routes)) throw protocolError();
    if (domains.some((domain) => domain.service === name) || routes.some((route) => route.script === name)) throw new ProviderError("provider_runtime_public_route", "Private runtime has a public route or domain.");
  }

  async ensurePrivateRuntime({ name, source, databaseId, releaseId }) {
    const bindings = databaseId ? [{ type: "d1", name: "DB", id: identifier(databaseId, "database ID") }] : [];
    const tags = await this.#tags(source, bindings, "runtime", releaseId);
    let existing = await this.inspectWorker(name);
    if (existing && (!existing.tags.includes("atrax-managed") || !existing.tags.some((tag) => tag === "atrax-kind:stub" || tag === "atrax-kind:runtime"))) throw new ProviderError("provider_resource_conflict", "Worker name is already owned by another resource.");
    if (existing && !existing.tags.includes(`atrax-release:${releaseId}`)) throw new ProviderError("provider_release_conflict", "Private runtime belongs to another release.");
    if (!existing) {
      const stubTags = await this.#tags(STUB, [], "stub", releaseId);
      existing = await this.#publish({ name, source: STUB, bindings: [], tags: stubTags });
    }
    // A new script may default to public. Only trusted, inert code exists until these checks pass.
    await this.#disablePublicUrls(name);
    await this.#checkRuntimeRoutes(name);
    if (!this.#matches(existing, tags, bindings)) {
      // A runtime name identifies one immutable release. Only its bootstrap stub may be replaced.
      if (existing.tags.includes("atrax-kind:runtime")) throw new ProviderError("provider_release_conflict", "Private runtime content differs from the recorded release.");
      existing = await this.#publish({ name, source, bindings, tags });
    }
    if (existing.workersDev || existing.previewsEnabled) {
      existing = await this.#observeAfterMutation(() => this.inspectWorker(name));
      if (!existing || existing.workersDev || existing.previewsEnabled) throw new ProviderError("provider_privacy_unverified", "Private runtime public URLs became enabled.", { retryable: true, uncertain: true });
    }
    return { name, versionId: existing.versionId };
  }

  async uploadGateway({ name, source, bindings, releaseId }) {
    bindings = validateBindings(bindings);
    const tags = await this.#tags(source, bindings, "gateway", releaseId);
    let existing = await this.inspectWorker(name);
    if (existing && (!existing.tags.includes("atrax-managed") || !existing.tags.includes("atrax-kind:gateway"))) throw new ProviderError("provider_resource_conflict", "Worker name is already owned by another resource.");
    if (!this.#matches(existing, tags, bindings)) existing = await this.#publish({ name, source, bindings, tags });
    await this.#disablePublicUrls(name);
    return { name, versionId: existing.versionId };
  }

  // Candidate identities are never reused or promoted into live Worker names.
  // Do not force deletion: Cloudflare must reject any remaining service binding.
  async deleteCandidateWorker({name,releaseId}) {
    if (!/^check-(run|web)-[a-f0-9]{32}$/.test(name)) invalid("Only candidate Workers can be removed.");
    const existing=await this.inspectWorker(name);
    if (!existing) return;
    const kinds=name.startsWith('check-run-')?['runtime','stub']:['gateway'];
    if (!existing.tags.includes('atrax-managed') || !existing.tags.includes(`atrax-release:${releaseId}`) || !kinds.some(kind=>existing.tags.includes(`atrax-kind:${kind}`))) throw new ProviderError('provider_resource_conflict','Candidate Worker ownership does not match.');
    await this.#checkRuntimeRoutes(name);
    let uncertain;
    try { await this.#request('DELETE',this.#scriptPath(name),undefined,{missing:true}); }
    catch(error) {if(!error.uncertain) throw error;uncertain=error;}
    if(await this.#observeAfterMutation(()=>this.inspectWorker(name))) throw uncertain ?? new ProviderError('provider_not_converged','Candidate Worker deletion is not yet observed.',{retryable:true,uncertain:true});
  }

  async deleteCandidateDomain({hostname,service}) {
    if (!/^check-web-[a-f0-9]{32}$/.test(service)) invalid('Only candidate domains can be removed.');
    const path=this.#accountPath('/workers/domains');
    const inspect=async()=>{
      const {result}=await this.#request('GET',`${path}?${new URLSearchParams({hostname})}`);
      if(!Array.isArray(result)) throw protocolError();
      const domain=result.find(value=>value.hostname===hostname);
      if(domain&&(domain.service!==service||domain.zone_id!==this.#zone||domain.environment!=='production')) throw new ProviderError('provider_domain_conflict','Candidate hostname ownership does not match.');
      return domain;
    };
    const domain=await inspect();if(!domain) return;
    let uncertain;
    try {await this.#request('DELETE',`${path}/${identifier(domain.id,'domain ID')}`,undefined,{missing:true});}
    catch(error) {if(!error.uncertain) throw error;uncertain=error;}
    if(await this.#observeAfterMutation(inspect)) throw uncertain ?? new ProviderError('provider_not_converged','Candidate domain deletion is not yet observed.',{retryable:true,uncertain:true});
  }

  async inspectCandidateDatabase(name) {
    if(!/^(check-[a-f0-9]{32}|restore-[a-f0-9]{32}-\d+)$/.test(name)) invalid('Only disposable candidate databases can be removed.');
    return this.#databasesNamed(name);
  }

  async deleteCandidateDatabase({id,name}) {
    const database=await this.inspectCandidateDatabase(name);if(!database) return;
    if(database.id!==id) throw new ProviderError('provider_resource_conflict','Candidate database ownership does not match.');
    let uncertain;
    try {await this.#request('DELETE',this.#accountPath(`/d1/database/${identifier(id,'database ID')}`),undefined,{missing:true});}
    catch(error) {if(!error.uncertain) throw error;uncertain=error;}
    if(await this.#observeAfterMutation(()=>this.#databasesNamed(name))) throw uncertain ?? new ProviderError('provider_not_converged','Candidate database deletion is not yet observed.',{retryable:true,uncertain:true});
  }

  async attachDomain({ hostname, service }) {
    identifier(service, "gateway service");
    if (typeof hostname !== "string" || hostname.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)) invalid("Invalid gateway hostname.");
    const path = this.#accountPath("/workers/domains");
    const inspect = async () => {
      const { result } = await this.#request("GET", `${path}?${new URLSearchParams({ hostname })}`);
      if (!Array.isArray(result)) throw protocolError();
      const domain = result.find((item) => item.hostname === hostname);
      if (!domain) return null;
      if (domain.service !== service || domain.zone_id !== this.#zone || domain.environment !== "production") throw new ProviderError("provider_domain_conflict", "Hostname already belongs to another Worker or zone.");
      if (typeof domain.id !== "string") throw protocolError();
      return { id: domain.id, hostname, service, zoneId: domain.zone_id };
    };
    const existing = await inspect();
    if (existing) return existing;
    try { await this.#request("PUT", path, { hostname, service, zone_id: this.#zone, environment: "production" }); }
    catch (error) {
      if (!(error instanceof ProviderError) || (!error.uncertain && error.status !== 409)) throw error;
      const observed = await this.#observeAfterMutation(inspect);
      if (observed) return observed;
      throw error;
    }
    const observed = await this.#observeAfterMutation(inspect);
    if (!observed) throw new ProviderError("provider_not_converged", "Gateway domain attachment has not been observed yet.", { retryable: true, uncertain: true });
    return observed;
  }
}
