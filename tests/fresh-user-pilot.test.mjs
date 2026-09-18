import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {cliResult,httpResult,recipePlatform} from './helpers/recipes-platform.mjs';

const repositoryCli=resolve(import.meta.dirname,'../bin/atrax.mjs');
const cli=resolve(process.env.ATRAX_PILOT_CLI ?? repositoryCli);
const testingPublishedCli=process.env.ATRAX_PILOT_CLI!==undefined;
const expectedVersion=testingPublishedCli ? '0.2.1' : JSON.parse(await readFile(resolve(import.meta.dirname,'../package.json'),'utf8')).version;

async function freePort() {
  const server=createServer();
  await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
  const {port}=server.address();
  await new Promise((resolveClose,reject)=>server.close(error=>error ? reject(error) : resolveClose()));
  return port;
}

async function startDev(cwd,configDirectory) {
  const port=await freePort();
  const child=spawn(process.execPath,[cli,'dev','--port',String(port),'--json'],{
    cwd,
    env:{...process.env,ATRAX_CONFIG_DIR:configDirectory},
    stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='',pending='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{stdout+=chunk;pending+=chunk;});
  child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolveUrl,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Timed out starting atrax dev.\n${stdout}\n${stderr}`)),30_000);
    const inspect=()=>{
      while(pending.includes('\n')) {
        const index=pending.indexOf('\n');
        const line=pending.slice(0,index);pending=pending.slice(index+1);
        if(!line) continue;
        const envelope=JSON.parse(line);
        if(envelope.status==='failed') {clearTimeout(timer);reject(new Error(JSON.stringify(envelope)));return;}
        if(envelope.result?.url) {clearTimeout(timer);resolveUrl(envelope.result.url);return;}
      }
    };
    child.stdout.on('data',inspect);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{if(code!==null) {clearTimeout(timer);reject(new Error(`atrax dev exited ${code}.\n${stdout}\n${stderr}`));}});
  });
  return {url,async close(){child.kill('SIGTERM');await new Promise((resolveClose,reject)=>{child.once('close',resolveClose);child.once('error',reject);});}};
}

async function localAction(url,name,input,key) {
  const response=await fetch(new URL(`__atrax/actions/${name}`,url),{
    method:'POST',
    headers:{'content-type':'application/json',...(key ? {'idempotency-key':key} : {})},
    body:JSON.stringify(input),
  });
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  return body.result;
}

async function firstDeployWithApproval(api,cwd) {
  const configDirectory=join(api.directory,'config-owner');
  const child=spawn(process.execPath,[cli,'deploy','--json'],{
    cwd,
    env:{...process.env,ATRAX_API_ORIGIN:api.origin,ATRAX_CONFIG_DIR:configDirectory},
    stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='',pending='';
  const approvals=[];
  let approvalStarted=false;
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    stdout+=chunk;pending+=chunk;
    while(pending.includes('\n')) {
      const index=pending.indexOf('\n'),line=pending.slice(0,index);pending=pending.slice(index+1);
      if(!line) continue;
      const result=JSON.parse(line).result;
      if(result?.status==='authorization_required'&&!approvalStarted) {
        approvalStarted=true;
        approvals.push((async()=>{
          const workspace=httpResult(await api.call('workspaces.create',{name:'Pilot Company',slug:'pilot-company'},'owner','pilot-workspace-v1'));
          httpResult(await api.call('auth.device.approve',{userCode:result.userCode,decision:'approve'},'owner'));
          return workspace;
        })());
      }
    }
  });
  child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolveClose,reject)=>{child.once('error',reject);child.once('close',resolveClose);});
  const [workspace]=await Promise.all(approvals);
  const envelopes=stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  return {code,stdout,stderr,envelopes,envelope:envelopes.at(-1),workspace};
}

async function installedVersion() {
  const child=spawn(process.execPath,[cli,'--version'],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const code=await new Promise((resolveClose,reject)=>{child.once('error',reject);child.once('close',resolveClose);});
  assert.equal(code,0,stderr);return stdout.trim();
}

async function appSession(api,person,appId) {
  const app=api.apps.get(appId);
  const row=await api.db.prepare('SELECT url,active_release_id FROM apps WHERE app_id=?').bind(appId).first();
  const worker=await api.mf.getWorker(app.releases.get(row.active_release_id).liveGateway);
  const navigation=await worker.fetch(row.url,{headers:{accept:'text/html'},redirect:'manual'});
  assert.equal(navigation.status,302);
  const login=new URL(navigation.headers.get('location'));
  const stateCookie=navigation.headers.get('set-cookie').split(';')[0];
  const allowed=await api.call('apps.login',{appId,hostname:new URL(row.url).hostname,state:login.searchParams.get('state')},person);
  if(allowed.status!==200) return {status:allowed.status,body:allowed.body};
  const callback=await worker.fetch(httpResult(allowed).redirectUrl,{headers:{cookie:stateCookie},redirect:'manual'});
  assert.equal(callback.status,302,await callback.clone().text());
  const cookie=callback.headers.get('set-cookie').split(';')[0];
  const response=await worker.fetch(row.url,{headers:{cookie}});
  return {status:response.status,body:await response.text(),cookie,worker,url:row.url};
}

async function sessionAction(session,bearerToken,name,input,key) {
  const response=await session.worker.fetch(new URL(`__atrax/actions/${name}`,session.url),{
    method:'POST',
    headers:{authorization:`Bearer ${bearerToken}`,'content-type':'application/json',...(key ? {'idempotency-key':key} : {})},
    body:JSON.stringify(input),
  });
  const text=await response.text();
  assert.equal(response.status,200,text);
  const body=JSON.parse(text);
  return body.result;
}

test('a fresh installed CLI reaches local persistence, first deploy, exact guest sharing, same-URL update, and revocation',{timeout:180_000},async t=>{
  const api=await recipePlatform(t);
  const configDirectory=join(api.directory,'config-fresh');
  assert.equal(await installedVersion(),expectedVersion);

  const created=cliResult(await api.run('fresh',['new','pilot-chat'],{executable:cli}));
  const root=created.directory;
  assert.match(await readFile(join(root,'AGENTS.md'),'utf8'),/deployment preserves the existing database/i);
  const generatedHtml=await readFile(join(root,'public','index.html'),'utf8');

  let local=await startDev(root,configDirectory);
  const sent=await localAction(local.url,'messages.send',{nickname:'Pilot',body:'survives restart'},'local-persistence-v1');
  await local.close();
  local=await startDev(root,configDirectory);
  const persisted=await localAction(local.url,'messages.list',{});
  assert.deepEqual(persisted.messages.map(message=>message.id),[sent.id]);
  await local.close();
  cliResult(await api.run('fresh',['build'],{cwd:root,executable:cli}));

  await api.signIn('owner');
  const firstAttempt=await firstDeployWithApproval(api,root);
  assert.equal(firstAttempt.code,0,firstAttempt.stdout+firstAttempt.stderr);
  assert.equal(firstAttempt.envelopes[0].result.status,'authorization_required');
  assert.equal(firstAttempt.workspace.workspace.slug,'pilot-company');
  const deployed=firstAttempt.envelope.result;
  const stableUrl=deployed.url;
  const firstHosted=await api.openApp('owner',deployed.appId);
  assert.equal(firstHosted.status,200,JSON.stringify(firstHosted));
  if(!testingPublishedCli) assert.match(firstHosted.body,/pilot-chat/);

  const hostedMessage=cliResult(await api.run('owner',['call','actions.call','--input',JSON.stringify({appId:deployed.appId,actionName:'messages.send',input:{nickname:'Pilot',body:'survives deploy'}}),'--key','hosted-message-v1'],{executable:cli}));
  assert.equal(hostedMessage.result.body,'survives deploy');
  const initialAccess=cliResult(await api.run('owner',['call','apps.access.get','--input',JSON.stringify({appId:deployed.appId})],{executable:cli}));
  const restricted=cliResult(await api.run('owner',['call','apps.access.set','--input',JSON.stringify({appId:deployed.appId,audience:'selected',personIds:[],expectedRevision:initialAccess.access.revision}),'--key','pilot-only-guest-v1'],{executable:cli}));
  assert.equal(restricted.access.audience,'selected');
  assert.deepEqual(restricted.access.personIds,[]);
  assert.equal((await api.openApp('owner',deployed.appId)).status,403,'maintenance authority does not imply permission to use the app');

  await api.signIn('alex');
  await api.signIn('outsider');
  const shared=cliResult(await api.run('owner',['share','alex@example.com','--actions','messages.list','--key','pilot-alex-share-v1'],{cwd:root,executable:cli}));
  assert.equal(shared.url,stableUrl);
  assert.equal(shared.audience.publicWeb,false);
  assert.equal(shared.workspaceAccessRemainsInEffect,true);
  assert.equal(shared.audience.workspace.policy,'selected');
  assert.deepEqual(shared.audience.workspace.people,[]);
  assert.equal((await api.openApp('alex',deployed.appId)).status,403);
  assert.equal((await api.openApp('outsider',deployed.appId)).status,403);
  const wrongEmail=await api.call('apps.guests.accept',{invitationId:shared.invitation.id},'outsider');
  assert.equal(wrongEmail.body.error.code,'invitation_email_mismatch');
  httpResult(await api.call('apps.guests.accept',{invitationId:shared.invitation.id},'alex'));
  const accepted=await appSession(api,'alex',deployed.appId);
  assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  const alexToken=api.people.alex.cookie.split('=',2)[1];
  const guestRead=await sessionAction(accepted,alexToken,'messages.list',{});
  assert.equal(guestRead.messages.some(message=>message.body==='survives deploy'),true);
  assert.equal((await api.call('actions.call',{appId:deployed.appId,actionName:'messages.list',input:{}},'outsider','pilot-outsider-read-v1')).status,403);

  await writeFile(join(root,'public','index.html'),generatedHtml.replace('</h1>','</h1><p>Updated release</p>'));
  const updated=cliResult(await api.run('owner',['deploy'],{cwd:root,executable:cli}));
  assert.equal(updated.url,stableUrl);
  const updatedGuest=await appSession(api,'alex',deployed.appId);
  assert.equal(updatedGuest.status,200);
  assert.match(updatedGuest.body,/Updated release/);
  const afterUpdate=await sessionAction(updatedGuest,alexToken,'messages.list',{});
  assert.equal(afterUpdate.messages.some(message=>message.body==='survives deploy'),true);

  const audience=httpResult(await api.call('apps.guests.list',{appId:deployed.appId},'owner'));
  assert.deepEqual(audience.guests.map(guest=>guest.email),['alex@example.com']);
  assert.equal(audience.audience.publicWeb,false);
  assert.deepEqual(audience.audience.workspace.people,[]);
  assert.deepEqual(audience.invitations.filter(invitation=>invitation.status==='pending'),[]);
  const guest=audience.guests[0];
  cliResult(await api.run('owner',['call','apps.guests.revoke','--input',JSON.stringify({appId:deployed.appId,personId:guest.personId}),'--key','pilot-alex-revoke-v1'],{executable:cli}));
  const revokedSession=await updatedGuest.worker.fetch(updatedGuest.url,{headers:{cookie:updatedGuest.cookie}});
  assert.equal(revokedSession.status,403,await revokedSession.clone().text());
  assert.equal((await api.openApp('alex',deployed.appId)).status,403);
  assert.ok((await api.mailbox()).every(message=>message.to.endsWith('@example.com')));
});
