import assert from "node:assert/strict";
import test from "node:test";
import { CloudflareProvider, ProviderError } from "../control-plane/src/provider.js";

const ENV = { CF_API_TOKEN: "test-secret-never-return", CP_ACCOUNT_ID: "account", CP_ZONE_ID: "zone" };
const SOURCE = 'export default { fetch() { return new Response("customer-code"); } };';
const ok = (result, extra = {}) => Response.json({ success: true, errors: [], result, ...extra });
const rejected = (status, message = ENV.CF_API_TOKEN) => Response.json({ success: false, errors: [{ code: 10000, message }] }, { status });

// Only the external Cloudflare API is replaced. Production provider code owns every transition.
function cloudflare() {
  const workers = new Map();
  const databases = new Map();
  const domains = new Map();
  const calls = [];
  const uploads = [];
  let sequence = 0;
  const fixture = {
    workers, databases, domains, calls, uploads, routes: [], before: null, after: null,
    async fetch(input, init) {
      const url = new URL(input);
      assert.equal(url.origin, "https://api.cloudflare.com");
      assert.equal(init.headers.authorization, `Bearer ${ENV.CF_API_TOKEN}`);
      const path = url.pathname.replace("/client/v4", "");
      const call = { method: init.method, path, query: url.searchParams, body: init.body, signal: init.signal };
      calls.push(call);
      const intercepted = await fixture.before?.(call);
      if (intercepted) return intercepted;
      let response;
      if (path === "/accounts/account/d1/database") {
        if (init.method === "GET") response = ok([...databases.values()].filter((db) => db.name === url.searchParams.get("name")));
        else {
          const { name } = JSON.parse(init.body);
          const db = { uuid: `database-${++sequence}`, name };
          databases.set(name, db);
          response = ok(db);
        }
      } else if (path === "/accounts/account/workers/domains") {
        if (init.method === "GET") response = ok([...domains.values()].filter((domain) => (!url.searchParams.has("hostname") || domain.hostname === url.searchParams.get("hostname")) && (!url.searchParams.has("service") || domain.service === url.searchParams.get("service"))));
        else {
          const domain = { id: `domain-${++sequence}`, ...JSON.parse(init.body) };
          domains.set(domain.hostname, domain);
          response = ok(domain);
        }
      } else if(path.startsWith('/accounts/account/workers/domains/')&&init.method==='DELETE') {
        const domain=[...domains.values()].find(value=>value.id===path.split('/').at(-1));
        if(!domain) response=rejected(404);
        else {domains.delete(domain.hostname);response=Response.json({success:true,errors:[]});}
      } else if(/^\/accounts\/account\/d1\/database\/[^/]+$/.test(path)&&init.method==='DELETE') {
        const database=[...databases.values()].find(value=>value.uuid===path.split('/').at(-1));
        if(!database) response=rejected(404);
        else {databases.delete(database.name);response=ok(null);}
      } else if (path === "/zones/zone/workers/routes") response = ok(fixture.routes);
      else {
        const match = /^\/accounts\/account\/workers\/scripts\/([^/]+)(.*)$/.exec(path);
        assert.ok(match, `Unexpected external request: ${init.method} ${path}`);
        const [, name, suffix] = match;
        const worker = workers.get(name);
        if (!suffix && init.method === "PUT") {
          assert.ok(init.body instanceof FormData);
          const metadata = JSON.parse(await init.body.get("metadata").text());
          const source = await init.body.get("worker.js").text();
          assert.equal(init.body.get("worker.js").type, "application/javascript+module");
          assert.equal(metadata.main_module, "worker.js");
          const next = { name, source, metadata, versionId: `version-${++sequence}`, enabled: worker?.enabled ?? true, previews_enabled: worker?.previews_enabled ?? true };
          uploads.push({ ...next });
          workers.set(name, next);
          response = ok({ id: name, deployment_id: next.versionId });
        } else if (!worker) response = rejected(404);
        else if(!suffix&&init.method==='DELETE') {
          assert.equal(url.searchParams.has('force'),false);
          if([...workers.values()].some(value=>value.metadata.bindings.some(binding=>binding.type==='service'&&binding.service===name))) response=rejected(409);
          else {workers.delete(name);response=new Response(null,{status:204});}
        }
        else if (suffix === "/settings") response = ok({ tags: worker.metadata.tags, bindings: worker.metadata.bindings });
        else if (suffix === "/deployments") response = ok({ deployments: [{ versions: [{ version_id: worker.versionId, percentage: 100 }] }] });
        else if (suffix === `/versions/${worker.versionId}`) response = ok({ id: worker.versionId, resources: { bindings: worker.metadata.bindings } });
        else if (suffix === "/subdomain") {
          if (init.method === "POST") Object.assign(worker, JSON.parse(init.body));
          response = ok({ enabled: worker.enabled, previews_enabled: worker.previews_enabled });
        } else assert.fail(`Unexpected external request: ${init.method} ${path}`);
      }
      await fixture.after?.(call);
      return response;
    },
  };
  fixture.provider = new CloudflareProvider(ENV, { fetch: fixture.fetch });
  return fixture;
}

test("database creation adopts a committed resource after its response is lost", async () => {
  const cf = cloudflare();
  let loseResponse = true;
  cf.after = (call) => {
    if (call.method === "POST" && loseResponse) {
      loseResponse = false;
      throw new Error(`Lost connection with ${ENV.CF_API_TOKEN}`);
    }
  };
  const first = await cf.provider.ensureDatabase("business-app-1");
  assert.deepEqual(await cf.provider.ensureDatabase("business-app-1"), first);
  assert.equal(cf.databases.size, 1);
  assert.equal(cf.calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(cf.calls.some((call) => call.method === "DELETE"), false);
});

test("database lookup traverses pages and requires an exact stable name", async () => {
  let calls = 0;
  const provider = new CloudflareProvider(ENV, { fetch: async (url, init) => {
    assert.equal(init.method, "GET");
    calls++;
    const page = new URL(url).searchParams.get("page");
    return ok(page === "1" ? [{ name: "app-other", uuid: "wrong" }] : [{ name: "app", uuid: "right" }], { result_info: { total_pages: 2 } });
  } });
  assert.deepEqual(await provider.ensureDatabase("app"), { name: "app", id: "right" });
  assert.equal(calls, 2);
});

test("migration statements and ledger insertion stay in one native D1 batch", async () => {
  const batch = [
    { sql: "CREATE TABLE contacts (id TEXT PRIMARY KEY)" },
    { sql: "INSERT INTO contacts VALUES (?)", params: ["person-1"] },
    { sql: "INSERT INTO _atrax_migrations VALUES (?, ?)", params: ["001", "hash"] },
  ];
  let calls = 0;
  const provider = new CloudflareProvider(ENV, { fetch: async (url, init) => {
    calls++;
    assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/account/d1/database/business/query");
    assert.deepEqual(JSON.parse(init.body), { batch });
    return ok(batch.map(() => ({ success: true, results: [] })));
  } });
  assert.equal((await provider.queryDatabase("business", batch)).length, 3);
  assert.equal(calls, 1);
});

test("uncertain database writes are never replayed inside the provider", async () => {
  let calls = 0;
  const provider = new CloudflareProvider(ENV, { fetch: async () => { calls++; throw new Error(ENV.CF_API_TOKEN); } });
  await assert.rejects(provider.queryDatabase("business", [{ sql: "UPDATE stock SET quantity = quantity - 1" }]), (error) => {
    assert.equal(error.uncertain, true);
    assert.equal(error.retryable, true);
    assert.ok(!JSON.stringify(error).includes(ENV.CF_API_TOKEN));
    return true;
  });
  assert.equal(calls, 1);
});

test("a failed statement is a batch failure and provider SQL diagnostics stay private", async () => {
  const provider = new CloudflareProvider(ENV, { fetch: async () => ok([{ success: false, error: "customer SQL secret" }]) });
  await assert.rejects(provider.queryDatabase("business", [{ sql: "INVALID" }]), { code: "provider_query_failed", uncertain: false });
});

test("new runtime starts inert, verifies both public URL switches, then receives only its own DB", async () => {
  const cf = cloudflare();
  const result = await cf.provider.ensurePrivateRuntime({ name: "runtime-app-release", source: SOURCE, databaseId: "business", releaseId: "release" });
  assert.equal(cf.uploads.length, 2);
  const [stub, runtime] = cf.uploads;
  assert.ok(!stub.source.includes("customer-code"));
  assert.deepEqual(stub.metadata.bindings, []);
  assert.equal(stub.enabled, true);
  assert.equal(stub.previews_enabled, true);
  assert.equal(runtime.enabled, false);
  assert.equal(runtime.previews_enabled, false);
  assert.equal(runtime.source, SOURCE);
  assert.deepEqual(runtime.metadata.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(runtime.metadata.bindings, [{ type: "d1", name: "DB", id: "business" }]);
  const inspected = await cf.provider.inspectWorker(result.name);
  assert.equal(inspected.versionId, result.versionId);
  assert.equal(inspected.workersDev, false);
  assert.equal(inspected.previewsEnabled, false);
  await cf.provider.ensurePrivateRuntime({ name: result.name, source: SOURCE, databaseId: "business", releaseId: "release" });
  assert.equal(cf.uploads.length, 2, "retry adopts the existing runtime");
});

test("privacy failure leaves only the trusted stub and a later call resumes", async () => {
  const cf = cloudflare();
  cf.before = (call) => call.method === "POST" && call.path.endsWith("/subdomain") ? rejected(503) : null;
  const input = { name: "runtime", source: SOURCE, releaseId: "release" };
  await assert.rejects(cf.provider.ensurePrivateRuntime(input), { uncertain: true });
  assert.equal(cf.uploads.length, 1);
  assert.ok(!cf.workers.get("runtime").source.includes("customer-code"));
  cf.before = null;
  await cf.provider.ensurePrivateRuntime(input);
  assert.equal(cf.uploads.length, 2);
  assert.equal(cf.workers.get("runtime").source, SOURCE);
});

test("runtime publication adopts a lost response without creating another version", async () => {
  const cf = cloudflare();
  cf.after = (call) => { if (call.method === "PUT" && cf.uploads.length === 2) throw new Error("connection closed"); };
  await cf.provider.ensurePrivateRuntime({ name: "runtime", source: SOURCE, releaseId: "release" });
  assert.equal(cf.uploads.length, 2);
});

test("a preview URL remaining enabled blocks customer code publication", async () => {
  const cf = cloudflare();
  cf.after = (call) => { if (call.path.endsWith("/subdomain") && call.method === "POST") cf.workers.get("runtime").previews_enabled = true; };
  await assert.rejects(cf.provider.ensurePrivateRuntime({ name: "runtime", source: SOURCE, releaseId: "release" }), { code: "provider_privacy_unverified" });
  assert.equal(cf.uploads.length, 1);
});

test("a private runtime with a public route is rejected before uploading customer code", async () => {
  const cf = cloudflare();
  cf.routes.push({ script: "runtime", pattern: "app.example.com/*" });
  await assert.rejects(cf.provider.ensurePrivateRuntime({ name: "runtime", source: SOURCE, releaseId: "release" }), { code: "provider_runtime_public_route" });
  assert.equal(cf.uploads.length, 1);
});

test("an immutable runtime release rejects changed source and preserves the deployed version", async () => {
  const cf = cloudflare();
  const input = { name: "runtime", source: SOURCE, releaseId: "release" };
  await cf.provider.ensurePrivateRuntime(input);
  await assert.rejects(cf.provider.ensurePrivateRuntime({ ...input, source: `${SOURCE}\n// changed` }), { code: "provider_release_conflict" });
  assert.equal(cf.uploads.length, 2);
});

test("gateway uploads native service/R2/small-variable metadata and reconciles a lost response", async () => {
  const cf = cloudflare();
  const bindings = [
    { type: "service", name: "RUNTIME", service: "runtime" },
    { type: "service", name: "DOOR", service: "control-plane", entrypoint: "Door" },
    { type: "r2_bucket", name: "ASSETS", bucket_name: "artifacts" },
    { type: "plain_text", name: "CONFIG_KEY", text: "apps/app/release.json" },
    { type: "plain_text", name: "RELEASE_ID", text: "release" },
  ];
  cf.after = (call) => { if (call.method === "PUT") throw new Error("response lost"); };
  const input = { name: "gateway", source: SOURCE, bindings, releaseId: "release" };
  const first = await cf.provider.uploadGateway(input);
  assert.deepEqual(await cf.provider.uploadGateway(input), first);
  assert.equal(cf.uploads.length, 1);
  const metadata = cf.uploads[0].metadata;
  assert.deepEqual(metadata.bindings.find((binding) => binding.name === "DOOR"), { type: "service", name: "DOOR", service: "control-plane", entrypoint: "Door", environment: "production" });
  assert.equal(cf.workers.get("gateway").enabled, false);
});

test("gateway rejects oversized UTF-8 vars, manifest vars and invalid native metadata before provider calls", async () => {
  const cf = cloudflare();
  for (const binding of [
    { type: "plain_text", name: "CONFIG_KEY", text: "é".repeat(2501) },
    { type: "plain_text", name: "MANIFEST", text: "{}" },
    { type: "service", name: "RUNTIME", service: "runtime", binding: "wrong-shape" },
    { type: "secret_text", name: "CF_API_TOKEN", text: "forbidden" },
  ]) {
    await assert.rejects(cf.provider.uploadGateway({ name: "gateway", source: SOURCE, releaseId: "release", bindings: [binding] }), { code: "provider_input_invalid" });
  }
  assert.equal(cf.calls.length, 0);
});

test("domain attach adopts an uncertain committed effect and refuses to replace another service", async () => {
  const cf = cloudflare();
  cf.after = (call) => { if (call.method === "PUT") throw new Error("response lost"); };
  const input = { hostname: "app.example.com", service: "gateway" };
  const first = await cf.provider.attachDomain(input);
  assert.equal(first.zoneId, "zone");
  assert.deepEqual(await cf.provider.attachDomain(input), first);
  assert.equal(cf.calls.filter((call) => call.method === "PUT").length, 1);
  await assert.rejects(cf.provider.attachDomain({ ...input, service: "unrelated" }), { code: "provider_domain_conflict" });
  assert.equal(cf.domains.get(input.hostname).service, "gateway");
});

test("only a real 404 means an absent Worker; authentication errors stay redacted", async () => {
  const cf = cloudflare();
  assert.equal(await cf.provider.inspectWorker("missing"), null);
  cf.before = () => rejected(403);
  await assert.rejects(cf.provider.inspectWorker("missing"), (error) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.status, 403);
    assert.equal(error.uncertain, false);
    assert.ok(!error.message.includes(ENV.CF_API_TOKEN));
    return true;
  });
});

test("timeout aborts the external request and reports an uncertain mutation", async () => {
  const provider = new CloudflareProvider(ENV, { timeoutMs: 5, fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error(ENV.CF_API_TOKEN)), { once: true });
  }) });
  await assert.rejects(provider.queryDatabase("business", [{ sql: "SELECT 1" }]), { code: "provider_timeout", retryable: true, uncertain: true });
});

test("a failed observation after successful publication remains an uncertain outcome", async () => {
  const cf = cloudflare();
  cf.before = (call) => cf.uploads.length && call.path.endsWith("/settings") ? rejected(403) : null;
  const input = { name: "gateway", source: SOURCE, bindings: [], releaseId: "release" };
  await assert.rejects(cf.provider.uploadGateway(input), { status: 403, uncertain: true, retryable: true });
  cf.before = null;
  await cf.provider.uploadGateway(input);
  assert.equal(cf.uploads.length, 1);
});

test("an unmanaged Worker is inspected without mutating its code or public settings", async () => {
  const cf = cloudflare();
  cf.workers.set("runtime", { name: "runtime", versionId: "version-1", metadata: { bindings: [] }, enabled: true, previews_enabled: true });
  await assert.rejects(cf.provider.ensurePrivateRuntime({ name: "runtime", source: SOURCE, releaseId: "release" }), { code: "provider_resource_conflict" });
  assert.equal(cf.calls.some((call) => call.method !== "GET"), false);
});

test("inspection rejects split traffic rather than reporting one version as fully published", async () => {
  const cf = cloudflare();
  await cf.provider.uploadGateway({ name: "gateway", source: SOURCE, bindings: [], releaseId: "release" });
  cf.before = (call) => call.path.endsWith("/deployments") ? ok({ deployments: [{ versions: [{ version_id: "version-1", percentage: 50 }, { version_id: "version-2", percentage: 50 }] }] }) : null;
  await assert.rejects(cf.provider.inspectWorker("gateway"), { code: "provider_deployment_conflict" });
});

test("an existing runtime's public URL drift is repaired without republishing its code", async () => {
  const cf = cloudflare();
  const input = { name: "runtime", source: SOURCE, releaseId: "release" };
  const first = await cf.provider.ensurePrivateRuntime(input);
  cf.workers.get("runtime").enabled = true;
  cf.workers.get("runtime").previews_enabled = true;
  assert.deepEqual(await cf.provider.ensurePrivateRuntime(input), first);
  assert.equal(cf.uploads.length, 2);
  assert.equal(cf.workers.get("runtime").enabled, false);
  assert.equal(cf.workers.get("runtime").previews_enabled, false);
});

test("a private runtime with a custom domain is rejected before uploading customer code", async () => {
  const cf = cloudflare();
  cf.domains.set("leak.example.com", { hostname: "leak.example.com", service: "runtime", zone_id: "zone", environment: "production" });
  await assert.rejects(cf.provider.ensurePrivateRuntime({ name: "runtime", source: SOURCE, releaseId: "release" }), { code: "provider_runtime_public_route" });
  assert.equal(cf.uploads.length, 1);
});

test("malformed provider responses never leak the body and leave a write uncertain", async () => {
  const provider = new CloudflareProvider(ENV, { fetch: async () => new Response(ENV.CF_API_TOKEN, { status: 502 }) });
  await assert.rejects(provider.queryDatabase("business", [{ sql: "SELECT 1" }]), (error) => {
    assert.equal(error.code, "provider_response_invalid");
    assert.equal(error.uncertain, true);
    assert.ok(!error.message.includes(ENV.CF_API_TOKEN));
    return true;
  });
});

test('snapshot export and import use polling bookmarks and MD5 without exposing signed URLs in errors',async()=>{
  const calls=[];
  const provider=new CloudflareProvider(ENV,{fetch:async(input,init)=>{
    calls.push({input,init,body:JSON.parse(init.body)});
    if(input.endsWith('/export')) return ok({at_bookmark:'snapshot-bookmark',status:'complete',result:{signed_url:'https://storage.example/signed-secret'}});
    if(JSON.parse(init.body).action==='init') return ok({filename:'snapshot.sql',upload_url:'https://storage.example/upload-secret'});
    return ok({at_bookmark:'import-bookmark',status:'complete'});
  }});
  assert.equal((await provider.exportDatabase('db','previous')).bookmark,'snapshot-bookmark');
  assert.deepEqual(calls[0].body,{output_format:'polling',current_bookmark:'previous'});
  const upload=await provider.importDatabase('db',{action:'init',etag:'d41d8cd98f00b204e9800998ecf8427e'});assert.equal(upload.filename,'snapshot.sql');
  assert.equal((await provider.importDatabase('db',{action:'ingest',etag:'md5',filename:upload.filename})).complete,true);
  await provider.importDatabase('db',{action:'poll',current_bookmark:'import-bookmark'});
  assert.deepEqual(calls[3].body,{action:'poll',current_bookmark:'import-bookmark'});
  const transfers=new CloudflareProvider(ENV,{fetch:async(input,init)=>{assert.equal(init.headers,undefined);assert.equal(init.redirect,'manual');assert.equal(init.method,'PUT');return new Response(null,{headers:{etag:'"expected"'}});}});
  await transfers.transferSnapshot('https://storage.example/upload',{body:new Uint8Array([1]),etag:'expected'});
  await assert.rejects(transfers.transferSnapshot('https://storage.example/upload',{body:new Uint8Array([1]),etag:'different'}),error=>error.code==='provider_transfer_checksum'&&!error.message.includes('storage.example'));
  const failure=new CloudflareProvider(ENV,{fetch:async()=>{throw new Error('https://storage.example/private?secret=token');}});
  await assert.rejects(failure.transferSnapshot('https://storage.example/private?secret=token'),error=>error.code==='provider_transfer_failed'&&!error.message.includes('token'));
});

test('native version D1 resource metadata converges by identity and rejects conflicting aliases',async()=>{
  const api=cloudflare();const externalFetch=api.fetch.bind(api);let conflicting=false;
  const provider=new CloudflareProvider(ENV,{fetch:async(input,init)=>{
    const response=await externalFetch(input,init);
    if(new URL(input).pathname.includes('/versions/')) {
      const body=await response.json();
      body.result.resources.bindings=body.result.resources.bindings.map(binding=>binding.type==='d1'?{...binding,database_id:conflicting?'another-database':binding.id}:binding);
      return Response.json(body);
    }
    return response;
  }});
  const input={name:'native-d1',source:SOURCE,databaseId:'own-db',releaseId:'release-one'};
  const first=await provider.ensurePrivateRuntime(input);assert.ok(first.versionId);
  const uploads=api.uploads.length;assert.equal((await provider.ensurePrivateRuntime(input)).versionId,first.versionId);assert.equal(api.uploads.length,uploads);
  conflicting=true;await assert.rejects(provider.ensurePrivateRuntime(input),error=>error.code==='provider_binding_conflict');
});

test('candidate deletion reconciles lost delete responses and never forces a referenced runtime',async()=>{
  const cf=cloudflare(),id='a'.repeat(32),runtime=`check-run-${id}`,gateway=`check-web-${id}`,hostname=`check-${id}.apps.example.com`;
  const database=await cf.provider.ensureDatabase(`check-${id}`);
  await cf.provider.ensurePrivateRuntime({name:runtime,source:SOURCE,databaseId:database.id,releaseId:'release'});
  await cf.provider.uploadGateway({name:gateway,source:SOURCE,bindings:[{type:'service',name:'RUNTIME',service:runtime,entrypoint:'AppRuntime'}],releaseId:'release'});
  await cf.provider.attachDomain({hostname,service:gateway});
  await assert.rejects(cf.provider.deleteCandidateWorker({name:gateway,releaseId:'release'}),{code:'provider_runtime_public_route'});
  await assert.rejects(cf.provider.deleteCandidateWorker({name:runtime,releaseId:'release'}),{code:'provider_rejected',status:409});
  cf.after=call=>{if(call.method==='DELETE') throw new Error('Committed deletion response lost');};
  await cf.provider.deleteCandidateDomain({hostname,service:gateway});
  await cf.provider.deleteCandidateWorker({name:gateway,releaseId:'release'});
  await cf.provider.deleteCandidateWorker({name:runtime,releaseId:'release'});
  await cf.provider.deleteCandidateDatabase(database);
  await cf.provider.deleteCandidateDomain({hostname,service:gateway});
  await cf.provider.deleteCandidateWorker({name:runtime,releaseId:'release'});
  await cf.provider.deleteCandidateDatabase(database);
  assert.equal(cf.workers.size,0);assert.equal(cf.databases.size,0);assert.equal(cf.domains.size,0);
});

test('candidate deletion rejects live names, identity drift, and changed ownership before removal',async()=>{
  const cf=cloudflare(),id='b'.repeat(32),runtime=`check-run-${id}`;
  await cf.provider.ensurePrivateRuntime({name:runtime,source:SOURCE,releaseId:'release'});
  await assert.rejects(cf.provider.deleteCandidateWorker({name:'runtime-business',releaseId:'release'}),{code:'provider_input_invalid'});
  await assert.rejects(cf.provider.deleteCandidateWorker({name:runtime,releaseId:'other'}),{code:'provider_resource_conflict'});
  await assert.rejects(cf.provider.deleteCandidateDatabase({name:'data-business',id:'business'}),{code:'provider_input_invalid'});
  const database=await cf.provider.ensureDatabase(`check-${id}`);
  await assert.rejects(cf.provider.deleteCandidateDatabase({...database,id:'other'}),{code:'provider_resource_conflict'});
  cf.domains.set(`check-${id}.example.com`,{id:'foreign',hostname:`check-${id}.example.com`,service:'other',zone_id:'zone',environment:'production'});
  await assert.rejects(cf.provider.deleteCandidateDomain({hostname:`check-${id}.example.com`,service:`check-web-${id}`}),{code:'provider_domain_conflict'});
  assert.equal(cf.calls.some(call=>call.method==='DELETE'),false);
});

test('provider diagnostics contain only method, pathname, HTTP status, and numeric error codes',async t=>{
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const secret='private-provider-message-and-request';
  const provider=new CloudflareProvider(ENV,{fetch:async()=>Response.json({success:false,errors:[{code:10000,message:ENV.CF_API_TOKEN},{code:10001,message:secret},{code:secret},{code:1.5},{code:-1},{code:{secret}}],messages:[secret],result:{secret}},{status:403})});
  await assert.rejects(provider.ensureDatabase(secret),error=>error.code==='provider_rejected'&&error.message==='Cloudflare rejected the operation.');
  await assert.rejects(provider.queryDatabase('database-id',[{sql:secret,params:[ENV.CF_API_TOKEN]}]),error=>error.code==='provider_rejected'&&!JSON.stringify(error).includes(secret));
  const transport=new CloudflareProvider(ENV,{fetch:async()=>{throw new Error(`${ENV.CF_API_TOKEN} https://provider.invalid/?secret=${secret}`);}});
  await assert.rejects(transport.inspectWorker('runtime'),{code:'provider_unavailable'});
  const malformed=new CloudflareProvider(ENV,{fetch:async()=>new Response(`${secret} ${ENV.CF_API_TOKEN}`,{status:502})});
  await assert.rejects(malformed.inspectWorker('runtime'),{code:'provider_response_invalid'});
  assert.deepEqual(logs,[
    ['atrax.provider.request_failed',{method:'GET',pathname:'/accounts/account/d1/database',status:403,codes:[10000,10001]}],
    ['atrax.provider.request_failed',{method:'POST',pathname:'/accounts/account/d1/database/database-id/query',status:403,codes:[10000,10001]}],
    ['atrax.provider.request_failed',{method:'GET',pathname:'/accounts/account/workers/scripts/runtime/settings',status:null,codes:[]}],
    ['atrax.provider.request_failed',{method:'GET',pathname:'/accounts/account/workers/scripts/runtime/settings',status:502,codes:[]}],
  ]);
  assert.ok(!JSON.stringify(logs).includes(secret));assert.ok(!JSON.stringify(logs).includes(ENV.CF_API_TOKEN));assert.ok(!JSON.stringify(logs).includes('?'));
});

test('native empty HTTP200 DELETE succeeds while nonempty malformed deletion responses remain uncertain',async t=>{
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const cf=cloudflare(),name=`check-run-${'d'.repeat(32)}`,input={name,source:SOURCE,releaseId:'release'};
  await cf.provider.ensurePrivateRuntime(input);
  cf.before=call=>{if(call.method==='DELETE') {cf.workers.delete(name);return new Response(null,{status:200});}};
  await cf.provider.deleteCandidateWorker(input);
  assert.equal(cf.workers.has(name),false);assert.deepEqual(logs,[],'A valid empty delete response must not report a protocol failure');
  await cf.provider.ensurePrivateRuntime(input);
  cf.before=call=>call.method==='DELETE'?new Response('malformed nonempty response',{status:200}):undefined;
  await assert.rejects(cf.provider.deleteCandidateWorker(input),{code:'provider_response_invalid',uncertain:true});
  assert.equal(cf.workers.has(name),true);
  const emptyRead=new CloudflareProvider(ENV,{fetch:async()=>new Response(null,{status:200})});
  await assert.rejects(emptyRead.inspectWorker('runtime'),{code:'provider_response_invalid'});
});
