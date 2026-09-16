import assert from 'node:assert/strict';
import {Response} from 'miniflare';
import {createHash} from 'node:crypto';
import {splitSqlQuery} from '../../cli/vendor/splitter.mjs';

const identifier=value=>`"${value.replaceAll('"','""')}"`;
function sqlValue(value) {
  if(value===null) return 'NULL';
  if(typeof value==='number') return String(value);
  if(typeof value==='string') return `'${value.replaceAll("'","''")}'`;
  if(Array.isArray(value)) return `X'${Buffer.from(value).toString('hex')}'`;
  throw new Error('Unsupported fixture SQLite value');
}
async function dump(db) {
  const {results}=await db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all();
  const sql=['PRAGMA defer_foreign_keys=ON'];
  for(const row of results) {
    sql.push(row.sql);
    if(row.type==='table') {
      const {results:values}=await db.prepare(`SELECT * FROM ${identifier(row.name)}`).all();
      for(const value of values) sql.push(`INSERT INTO ${identifier(row.name)} (${Object.keys(value).map(identifier).join(',')}) VALUES (${Object.values(value).map(sqlValue).join(',')})`);
    }
  }
  return `${sql.join(';\n')};\n`;
}

// Models only the external Cloudflare control API. D1 executes actual local SQL;
// app HTTP is routed back through the real protected gateway by the test caller.
export function providerApi() {
  const workers=new Map(),databases=new Map(),domains=new Map(),calls=[],exports=new Map(),imports=new Map();
  let sequence=0;
  const okay=result=>Response.json({success:true,errors:[],result});
  const rejected=status=>Response.json({success:false,errors:[{code:10000,message:'Injected provider rejection'}]},{status});
  return {
    workers,databases,domains,calls,exports,imports,before:null,after:null,database:null,
    async fetch(request) {
      const url=new URL(request.url);
      if(url.origin==='https://storage.atrax.test') {
        if(url.pathname.startsWith('/export/')) return new Response(exports.get(url.pathname.split('/').at(-1)),{headers:{'Content-Type':'application/sql'}});
        const upload=imports.get(url.pathname.split('/').at(-1));assert.ok(upload);
        assert.equal(request.method,'PUT');const bytes=Buffer.from(await request.arrayBuffer());
        assert.equal(createHash('md5').update(bytes).digest('hex'),upload.md5);
        upload.sql=bytes.toString('utf8');return new Response(null,{headers:{etag:upload.md5}});
      }
      assert.equal(url.origin,'https://api.cloudflare.com');
      const path=url.pathname.replace('/client/v4','');
      const call={method:request.method,path,query:url.searchParams};calls.push(call);
      const intercepted=await this.before?.(call);if(intercepted) return intercepted;
      let response;
      if(path==='/accounts/account/workers/domains') {
        if(request.method==='GET') response=okay([...domains.values()].filter(value=>(!url.searchParams.has('hostname')||value.hostname===url.searchParams.get('hostname'))&&(!url.searchParams.has('service')||value.service===url.searchParams.get('service'))));
        else {const value={id:`domain-${++sequence}`,...await request.json()};domains.set(value.hostname,value);response=okay(value);}
      } else if(path.startsWith('/accounts/account/workers/domains/')&&request.method==='DELETE') {
        const domain=[...domains.values()].find(value=>value.id===path.split('/').at(-1));
        if(!domain) response=rejected(404);
        else {domains.delete(domain.hostname);response=Response.json({success:true,errors:[]});}
      } else if(path==='/zones/zone/workers/routes') response=okay([]);
      else if(path==='/accounts/account/d1/database') {
        if(request.method==='GET') response=okay([...databases.values()].filter(value=>value.name===url.searchParams.get('name')));
        else {const {name}=await request.json();const value={uuid:`database-${++sequence}`,name};databases.set(name,value);response=okay(value);}
      } else if(/^\/accounts\/account\/d1\/database\/[^/]+$/.test(path)&&request.method==='DELETE') {
        const database=[...databases.values()].find(value=>value.uuid===path.split('/').at(-1));
        if(!database) response=rejected(404);
        else {databases.delete(database.name);response=Response.json({success:true,result:null});}
      } else if(/^\/accounts\/account\/d1\/database\/[^/]+\/export$/.test(path)) {
        const id=path.split('/')[5];const input=await request.json();
        assert.equal(input.output_format,'polling');const bookmark=input.current_bookmark ?? `bookmark-${++sequence}`;
        if(!exports.has(bookmark)) exports.set(bookmark,await dump(await this.database(id)));
        response=okay({status:'complete',at_bookmark:bookmark,result:{signed_url:`https://storage.atrax.test/export/${bookmark}`,filename:`${bookmark}.sql`}});
      } else if(/^\/accounts\/account\/d1\/database\/[^/]+\/import$/.test(path)) {
        const id=path.split('/')[5];const input=await request.json();call.input=input;
        if(input.action==='init') {
          const filename=`import-${++sequence}`;imports.set(filename,{databaseId:id,md5:input.etag ?? input.md5});
          response=okay({filename,upload_url:`https://storage.atrax.test/import/${filename}`});
        } else if(input.action==='ingest') {
          const upload=imports.get(input.filename);assert.ok(upload?.sql);assert.equal(upload.databaseId,id);
          const db=await this.database(id);await db.batch(splitSqlQuery(upload.sql).map(sql=>db.prepare(sql)));
          upload.complete=true;response=okay({success:true,status:'complete',at_bookmark:`imported-${++sequence}`,result:{num_queries:splitSqlQuery(upload.sql).length}});
        } else if(input.action==='poll') response=okay({success:true,status:'complete',at_bookmark:input.current_bookmark});
        else assert.fail(`Unexpected import action ${input.action}`);
      } else if(/^\/accounts\/account\/d1\/database\/[^/]+\/query$/.test(path)) {
        const id=path.split('/')[5];const db=await this.database(id);const {batch}=await request.json();call.batch=batch;
        response=okay(await db.batch(batch.map(({sql,params=[]})=>db.prepare(sql).bind(...params))));
      } else {
        const match=/^\/accounts\/account\/workers\/scripts\/([^/]+)(.*)$/.exec(path);
        assert.ok(match,`Unexpected provider route ${path}`);
        const [,name,suffix]=match;const worker=workers.get(name);
        if(!suffix&&request.method==='PUT') {
          const form=await request.formData();const metadata=JSON.parse(await form.get('metadata').text());const source=await form.get('worker.js').text();
          workers.set(name,{name,source,metadata,versionId:`version-${++sequence}`,enabled:worker?.enabled??true,previews_enabled:worker?.previews_enabled??true});
          response=okay({id:name,deployment_id:workers.get(name).versionId});
        } else if(!worker) response=rejected(404);
        else if(!suffix&&request.method==='DELETE') {
          assert.equal(url.searchParams.has('force'),false,'Cleanup must not force-delete referenced Workers');
          if([...workers.values()].some(value=>value.metadata.bindings.some(binding=>binding.type==='service'&&binding.service===name))) response=rejected(409);
          else {workers.delete(name);response=new Response(null,{status:204});}
        }
        else if(suffix==='/settings') response=okay({tags:worker.metadata.tags,bindings:worker.metadata.bindings});
        else if(suffix==='/deployments') response=okay({deployments:[{versions:[{version_id:worker.versionId,percentage:100}]}]});
        else if(suffix===`/versions/${worker.versionId}`) response=okay({id:worker.versionId,resources:{bindings:worker.metadata.bindings}});
        else if(suffix==='/subdomain') {if(request.method==='POST') Object.assign(worker,await request.json());response=okay({enabled:worker.enabled,previews_enabled:worker.previews_enabled});}
        else assert.fail(`Unexpected provider route ${path}`);
      }
      await this.after?.(call);
      return response;
    },
  };
}
