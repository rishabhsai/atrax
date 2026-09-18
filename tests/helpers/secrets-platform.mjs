import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Miniflare} from 'miniflare';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {buildApp} from '../../cli/build.mjs';
import {bundlePlatform,localWorker,migrateControlPlane} from '../../cli/local-platform.mjs';

const root=resolve(import.meta.dirname,'../..');
const json=value=>({type:'json',value});
const service=(worker,exportName)=>({type:'worker',worker,exportName});
export async function createSecretsPlatform(t,{encryptionKey=randomBytes(32).toString('base64'),consoleOrigin='https://console.atrax.test',host='127.0.0.1',port=0}={}) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-secrets-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'atrax.json'),JSON.stringify({version:2,name:'signer',actions:{entry:'actions.js'}}));
  await writeFile(join(directory,'actions.js'),`export const actions={"signing.sign":{description:'Sign a message using a granted credential',effect:'read',inputSchema:{type:'object',properties:{message:{type:'string'},binding:{type:'string'}},required:['message'],additionalProperties:false},outputSchema:{type:'object',properties:{signature:{type:'string'}},required:['signature'],additionalProperties:false},async handler(input,ctx){const value=await ctx.secrets.get(input.binding??'SIGNING_KEY');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input.message));return {signature:Array.from(new Uint8Array(signed),b=>b.toString(16).padStart(2,'0')).join('')};}}};`);
  const artifact=await buildApp(directory);
  const gateway=await bundlePlatform('gateway/src/index.js');
  let mf;
  const control=localWorker('control',await bundlePlatform('control-plane/src/index.js'),{CP_DB:{type:'d1',id:'secrets'},CONSOLE_ORIGIN:json(consoleOrigin),AUTH_ORIGIN:json(`http://${host}:${port}`),SECRETS_ENCRYPTION_KEY:json(encryptionKey)});
  control.dev={outboundService:{type:'fetcher',handler:request=>mf.dispatchFetch(request)}};
  const workers=[control,localWorker('runtime',artifact.runtime)];
  for(const id of ['signer','other']) {
    const worker=localWorker(id,gateway,{APP_ID:json(id),RELEASE_ID:json(`${id}-release`),WORKSPACE_ID:json('company'),CONFIG_KEY:json(`${id}.json`),ARTIFACTS:{type:'r2',name:'secrets-artifacts'},DOOR:service('control','Door'),SECRETS:service('control','Secrets'),RUNTIME:service('runtime','AppRuntime')});
    worker.config.triggers=[{type:'fetch',pattern:`https://${id}.atrax.test/*`},{type:'fetch',pattern:`https://${id}-preview.atrax.test/*`}];
    workers.push(worker);
  }
  mf=new Miniflare({host,port,workers});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control');await migrateControlPlane(db);
  const now=Date.now(),tokens={owner:'a'.repeat(64),member:'b'.repeat(64),outsider:'c'.repeat(64)};
  await db.batch([
    ...Object.entries(tokens).flatMap(([person,token])=>[
      db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(person,`${person}@example.com`,now,now),
      db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,agent_label,created_at,expires_at) VALUES(?,?,?,'agent','Secrets test agent',?,?)").bind(`${person}-session`,person,createHash('sha256').update(token).digest('hex'),now,now+3600000),
    ]),
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?),('elsewhere','Elsewhere','elsewhere','outsider',?)").bind(now,now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?),('elsewhere','outsider','owner','active',?)").bind(now,now,now),
  ]);
  for(const id of ['signer','other']) {
    await db.batch([
      db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at,active_release_id) VALUES(?,'company',?,?,?,?,'ready','workspace','owner',?,?,?)").bind(id,id,id,id,`https://${id}.atrax.test`,now,now,`${id}-release`),
      db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,'owner',?)").bind(`${id}-release`,id,artifact.hash,'artifact',JSON.stringify(artifact.manifest),JSON.stringify(artifact.actions),'[]',now),
      db.prepare("INSERT INTO app_hosts(hostname,app_id,kind) VALUES(?,?,'live')").bind(`${id}.atrax.test`,id),
      db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'preview')").bind(`${id}-preview.atrax.test`,id,`${id}-release`),
      db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,'signing.sign','workspace')").bind(id),
      db.prepare("INSERT INTO app_maintainers(app_id,person_id) VALUES(?,'owner')").bind(id),
    ]);
    const bucket=await mf.getR2Bucket('ARTIFACTS',id);
    await bucket.put(`${id}.json`,JSON.stringify({manifest:artifact.manifest,actions:artifact.actions,assets:{},assetPrefix:'assets/'}));
  }
  const address=new URL((await mf.ready).origin);address.hostname=host;const origin=address.origin;
  const browserToken=randomBytes(32).toString('hex');
  await db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,created_at,expires_at) VALUES('owner-browser','owner',?,'browser',?,?)").bind(createHash('sha256').update(browserToken).digest('hex'),now,now+3600000).run();
  const configs={};
  for(const person of Object.keys(tokens)) {
    configs[person]=join(directory,person);await mkdir(configs[person]);
    await writeFile(join(configs[person],'credentials.json'),JSON.stringify({origin,accessToken:tokens[person],session:{id:`${person}-session`},person:{id:person},workspaceId:'company'}));
  }
  async function call(operation,input={},person='owner',key=crypto.randomUUID()) {
    const response=await fetch(`${origin}/v1/operations/${operation}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[person]}`,'Idempotency-Key':key},body:JSON.stringify({workspaceId:'company',...input})});
    const body=await response.json();return {status:response.status,body,result:body.result};
  }
  async function okay(...args) {const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result.body));return result.result;}
  async function sign({app='signer',person='member',preview=false,binding='SIGNING_KEY'}={}) {
    const response=await mf.dispatchFetch(`https://${app}${preview?'-preview':''}.atrax.test/__atrax/actions/signing.sign`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[person]}`},body:JSON.stringify({message:'verify shared credential',binding})});
    return {status:response.status,body:await response.json()};
  }
  async function run(person,args,stdin='') {
    const child=spawn(process.execPath,[join(root,'bin/atrax.mjs'),...args,'--json'],{cwd:directory,env:{...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:configs[person]},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.stdin.end(stdin);
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    return {code,stdout,stderr,body:JSON.parse(stdout)};
  }
  async function mcp(person) {
    const client=new Client({name:'secrets-test',version:'1'});
    await client.connect(new StdioClientTransport({command:process.execPath,args:[join(root,'bin/atrax.mjs'),'mcp','--workspace','company'],env:{...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:configs[person]},stderr:'pipe'}));
    t.after(()=>client.close());return client;
  }
  return {directory,origin,mf,db,tokens,browserToken,configs,artifact,call,okay,sign,run,mcp};
}
