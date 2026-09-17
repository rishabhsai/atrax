import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,localMailboxSource,migrateControlPlane} from '../cli/local-platform.mjs';

const root=resolve(import.meta.dirname,'..');
const consoleOrigin='https://console.atrax.test';

// Run the shipped entry point. Only the external email transport is replaced.
async function platform(t) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-session-api-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const mf=new Miniflare({host:'127.0.0.1',port:0,workers:[
    localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
      CP_DB:{type:'d1',id:'session-api-db'},
      AUTH_ORIGIN:{type:'json',value:'https://api.atrax.test'},
      CONSOLE_ORIGIN:{type:'json',value:consoleOrigin},
      EMAIL_FROM:{type:'json',value:'sign-in@atrax.test'},
      EMAIL:{type:'worker',worker:'mailbox',exportName:'Mail'},
    }),
    localWorker('mailbox',localMailboxSource),
  ]});
  t.after(()=>mf.dispose());
  await migrateControlPlane(await mf.getD1Database('CP_DB','control-plane'));
  const origin=(await mf.ready).origin;
  const configDirectory=join(directory,'config');
  const env={...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:configDirectory};
  async function call(name,input={},headers={}) {
    const response=await fetch(`${origin}/v1/operations/${name}`,{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...headers},
      body:JSON.stringify(input),signal:AbortSignal.timeout(10000),
    });
    return {response,body:await response.json()};
  }
  async function browserSignIn(email) {
    const started=await call('auth.email.start',{email},{Origin:consoleOrigin});
    assert.equal(started.response.status,200,JSON.stringify(started.body));
    const messages=await (await (await mf.getWorker('mailbox')).fetch('https://mailbox.test')).json();
    const link=new URL(messages.at(-1).text.match(/https:\/\/\S+/)[0]);
    assert.equal(link.origin,consoleOrigin);
    assert.equal(link.pathname,'/auth/confirm');
    assert.equal(link.search,'');
    const proof=new URLSearchParams(link.hash.slice(1));
    const verified=await call('auth.email.verify',{
      challengeId:proof.get('challengeId'),secret:proof.get('secret'),
    },{Origin:consoleOrigin});
    assert.equal(verified.response.status,200,JSON.stringify(verified.body));
    assert.equal(verified.response.headers.get('access-control-allow-origin'),consoleOrigin);
    assert.equal(verified.response.headers.get('access-control-allow-credentials'),'true');
    const cookie=verified.response.headers.get('set-cookie');
    assert.match(cookie,/; HttpOnly/);
    assert.match(cookie,/; Secure/);
    return {cookie:cookie.split(';')[0],person:verified.body.result.person};
  }
  return {directory,configDirectory,env,call,browserSignIn,origin};
}

function startCli(t,fixture,args) {
  const child=spawn(process.execPath,[join(root,'bin/atrax.mjs'),...args,'--json'],{
    cwd:fixture.directory,env:fixture.env,stdio:['ignore','pipe','pipe'],
  });
  let stdout='',stderr='',pending='';
  const records=[];
  let resolveFirst;
  const first=new Promise(resolve=>{resolveFirst=resolve;});
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    stdout+=chunk;
    pending+=chunk;
    while(pending.includes('\n')) {
      const boundary=pending.indexOf('\n');
      const line=pending.slice(0,boundary);
      pending=pending.slice(boundary+1);
      if(!line.trim()) continue;
      try {records.push(JSON.parse(line));} catch {records.push({invalidJson:true});}
      if(records.length===1) resolveFirst(records[0]);
    }
  });
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const closed=new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('close',(code,signal)=>{
      resolveFirst(null);
      resolve({code,signal,stdout,stderr,records});
    });
  });
  const timeout=setTimeout(()=>child.kill('SIGKILL'),20000);
  closed.then(()=>clearTimeout(timeout),()=>clearTimeout(timeout));
  t.after(async()=>{
    if(child.exitCode===null && child.signalCode===null) child.kill('SIGKILL');
    await closed;
  });
  return {first,closed};
}

function assertSafeOutput(output,secrets=[]) {
  assert.equal(output.stderr.length,0,'CLI must not write credentials or diagnostics on this successful path');
  assert.equal(output.stdout.includes('accessToken'),false,'CLI output must not contain a bearer field');
  assert.equal(output.stdout.includes('deviceCode'),false,'CLI output must not contain the polling secret');
  for(const secret of secrets) assert.equal(output.stdout.includes(secret),false,'CLI output must not contain a credential');
  for(const record of output.records) assert.equal(record.invalidJson,undefined,'Every CLI output line must be JSON');
}

test('first workspace setup completes browser approval and leaves the CLI ready to deploy', {timeout:45000},async t=>{
  const fixture=await platform(t);
  const browser=await fixture.browserSignIn('operator@example.com');
  const browserHeaders={Cookie:browser.cookie,Origin:consoleOrigin};
  const login=startCli(t,fixture,['login','--agent','Operations agent']);
  const prompt=await login.first;
  assert.equal(prompt?.status,'succeeded');
  assert.equal(prompt.result.status,'authorization_required');
  assert.match(prompt.result.userCode,/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  const verification=new URL(prompt.result.verificationUri);
  assert.equal(verification.origin,consoleOrigin);
  assert.equal(verification.pathname,'/auth/device');
  assert.equal(verification.searchParams.get('code'),prompt.result.userCode);
  const inspected=await fixture.call('auth.device.get',{userCode:prompt.result.userCode},browserHeaders);
  assert.equal(inspected.response.status,200,JSON.stringify(inspected.body));
  assert.equal(inspected.body.result.clientName,'Atrax CLI');
  assert.equal(inspected.body.result.agentLabel,'Operations agent');
  assert.equal(inspected.body.result.status,'pending');
  const emptyDirectory=await fixture.call('workspaces.list',{},browserHeaders);
  assert.deepEqual(emptyDirectory.body.result.workspaces,[],'a new person starts without a deployment workspace');
  const createdByBrowser=await fixture.call('workspaces.create',{
    name:'Paper Company',slug:'paper-company',
  },browserHeaders);
  assert.equal(createdByBrowser.response.status,200,JSON.stringify(createdByBrowser.body));
  assert.equal(createdByBrowser.body.result.membership.role,'owner');
  const workspaceId=createdByBrowser.body.result.workspace.id;
  const approved=await fixture.call('auth.device.approve',{userCode:prompt.result.userCode,decision:'approve'},browserHeaders);
  assert.equal(approved.response.status,200,JSON.stringify(approved.body));
  const loggedIn=await login.closed;
  assert.equal(loggedIn.code,0,'CLI login must finish successfully');
  assert.equal(loggedIn.records.length,2);
  assert.equal(loggedIn.records[1].result.person.id,browser.person.id);
  assert.equal(loggedIn.records[1].result.session.kind,'agent');
  assert.equal(loggedIn.records[1].result.session.agentLabel,'Operations agent');

  const credentialPath=join(fixture.configDirectory,'credentials.json');
  const credentials=JSON.parse(await readFile(credentialPath,'utf8'));
  assert.equal((await stat(credentialPath)).mode & 0o777,0o600);
  assert.equal((await stat(fixture.configDirectory)).mode & 0o777,0o700);
  assert.equal(credentials.origin,fixture.origin);
  assert.equal(credentials.person.id,browser.person.id);
  assert.equal(typeof credentials.accessToken,'string');
  assert.equal(credentials.accessToken.length,64);
  const secrets=[credentials.accessToken,browser.cookie.split('=')[1]];
  assertSafeOutput(loggedIn,secrets);

  async function cli(args) {
    const output=await startCli(t,fixture,args).closed;
    assertSafeOutput(output,secrets);
    assert.equal(output.code,0,'CLI workspace or logout command must finish successfully');
    assert.equal(output.records.length,1);
    assert.equal(output.records[0].status,'succeeded');
    return output.records[0].result;
  }
  const listed=await cli(['workspace','list']);
  assert.deepEqual(listed.workspaces.map(workspace=>workspace.id),[workspaceId]);
  const selected=await cli(['workspace','use',workspaceId]);
  assert.equal(selected.workspace.id,workspaceId);
  const stored=JSON.parse(await readFile(credentialPath,'utf8'));
  assert.equal(stored.workspaceId,workspaceId);
  assert.equal(stored.accessToken===credentials.accessToken,true,'Selecting a workspace must retain this session');
  assert.equal((await stat(credentialPath)).mode & 0o777,0o600);
  const browserWorkspaces=await fixture.call('workspaces.list',{},browserHeaders);
  assert.deepEqual(browserWorkspaces.body.result.workspaces.map(workspace=>workspace.id),[workspaceId]);
  assert.deepEqual(await cli(['logout']),{signedOut:true});
  await assert.rejects(readFile(credentialPath),{code:'ENOENT'});
  const revoked=await fixture.call('auth.session.get',{}, {Authorization:`Bearer ${credentials.accessToken}`});
  assert.equal(revoked.response.status,401);
  assert.equal(revoked.body.error.code,'unauthorized');
  const browserSession=await fixture.call('auth.session.get',{},browserHeaders);
  assert.equal(browserSession.response.status,200,'CLI logout must preserve the approving browser session');
  const signedOut=await startCli(t,fixture,['workspace','list']).closed;
  assertSafeOutput(signedOut,secrets);
  assert.equal(signedOut.code,1);
  assert.equal(signedOut.records[0].error.code,'unauthorized');
});
