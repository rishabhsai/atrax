import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {
  bundlePlatform,
  localMailboxSource,
  localWorker,
  migrateControlPlane,
} from '../cli/local-platform.mjs';

const consoleOrigin='https://console.atrax.test';
const apiOrigin='https://api.atrax.test';
const appOrigin='https://orders.atrax.test';
const candidateOrigin='https://orders-candidate.atrax.test';
const appId='orders-app';
const releaseId='orders-release';
const workspaceId='paper-company';
const assetBytes=new TextEncoder().encode('<h1>Company orders</h1>');
const assetHash=createHash('sha256').update(assetBytes).digest('hex');
const descriptors=[{
  name:'orders.inspect',
  description:'Inspect one order',
  effect:'read',
  inputSchema:{
    type:'object',
    required:['orderId'],
    properties:{orderId:{type:'string'}},
    additionalProperties:false,
  },
  outputSchema:{
    type:'object',
    required:['orderId','actorId'],
    properties:{orderId:{type:'string'},actorId:{type:'string'}},
    additionalProperties:false,
  },
}];
const config={
  manifest:{
    version:2,
    name:'orders',
    web:{assets:'dist',fallback:'index.html'},
    actions:{entry:'actions.js'},
  },
  actions:descriptors,
  assets:{
    '/index.html':{
      hash:assetHash,
      size:assetBytes.byteLength,
      contentType:'text/html; charset=utf-8',
    },
  },
  assetPrefix:`assets/${releaseId}/`,
};

const frontSource=`
export default {
  fetch(request, env) {
    const hostname = new URL(request.url).hostname;
    if (hostname === 'api.atrax.test') return env.CONTROL.fetch(request);
    if (hostname === 'orders.atrax.test' || hostname === 'orders-candidate.atrax.test') {
      return env.GATEWAY.fetch(request);
    }
    return new Response('Unknown test host', { status: 404 });
  },
};
`;

const runtimeSource=`
import {WorkerEntrypoint} from 'cloudflare:workers';
export default class AppRuntime extends WorkerEntrypoint {
  describe() { return this.env.DESCRIPTORS; }
  invoke(name, input, _capability, caller) {
    if (name !== 'orders.inspect') throw new Error('Unknown action');
    return { ok: true, result: { orderId: input.orderId, actorId: caller.person.id } };
  }
}
`;

function service(worker,exportName) {
  return {type:'worker',worker,...(exportName ? {exportName} : {})};
}

function json(value) {
  return {type:'json',value};
}

function cookieValue(headers,name) {
  const values=headers.getSetCookie?.() ?? [headers.get('set-cookie')];
  const cookie=values.find((value)=>value?.startsWith(`${name}=`));
  assert.ok(cookie,`Expected ${name} cookie`);
  return cookie.split(';',1)[0];
}

async function platform(t) {
  const [controlSource,gatewaySource]=await Promise.all([
    bundlePlatform('control-plane/src/index.js'),
    bundlePlatform('gateway/src/index.js'),
  ]);
  const mf=new Miniflare({workers:[
    localWorker('front',frontSource,{
      CONTROL:service('control-plane'),
      GATEWAY:service('gateway'),
    }),
    localWorker('control-plane',controlSource,{
      CP_DB:{type:'d1',id:'app-login-control-plane'},
      AUTH_ORIGIN:json(apiOrigin),
      CONSOLE_ORIGIN:json(consoleOrigin),
      EMAIL_FROM:json('sign-in@atrax.test'),
      EMAIL:service('mailbox','Mail'),
    }),
    localWorker('gateway',gatewaySource,{
      APP_ID:json(appId),
      RELEASE_ID:json(releaseId),
      WORKSPACE_ID:json(workspaceId),
      CONFIG_KEY:json(`configs/${releaseId}.json`),
      CONSOLE_ORIGIN:json(consoleOrigin),
      ARTIFACTS:{type:'r2',name:'app-login-artifacts'},
      DOOR:service('control-plane','Door'),
      RUNTIME:service('runtime'),
    }),
    localWorker('runtime',runtimeSource,{DESCRIPTORS:json(descriptors)}),
    localWorker('mailbox',localMailboxSource),
  ]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const artifacts=await mf.getR2Bucket('ARTIFACTS','gateway');
  await artifacts.put(`configs/${releaseId}.json`,JSON.stringify(config));
  await artifacts.put(`assets/${releaseId}/${assetHash}`,assetBytes);

  async function fetchHost(url,init={}) {
    return mf.dispatchFetch(url,{redirect:'manual',...init});
  }

  async function operation(name,input={},cookie) {
    const response=await fetchHost(`${apiOrigin}/v1/operations/${name}`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        origin:consoleOrigin,
        'idempotency-key':crypto.randomUUID(),
        ...(cookie ? {cookie} : {}),
      },
      body:JSON.stringify(input),
    });
    return {response,body:await response.json()};
  }

  async function mailbox() {
    return (await (await mf.getWorker('mailbox')).fetch('https://mailbox.test')).json();
  }

  async function signIn(email) {
    const started=await operation('auth.email.start',{email});
    assert.equal(started.response.status,200,JSON.stringify(started.body));
    const messages=await mailbox();
    const link=new URL(messages.at(-1).text.match(/https:\/\/\S+/)[0]);
    const proof=new URLSearchParams(link.hash.slice(1));
    const verified=await operation('auth.email.verify',{
      challengeId:proof.get('challengeId'),
      secret:proof.get('secret'),
    });
    assert.equal(verified.response.status,200,JSON.stringify(verified.body));
    return {
      cookie:cookieValue(verified.response.headers,'__Host-atrax_session'),
      person:verified.body.result.person,
      session:verified.body.result.session,
    };
  }

  return {db,fetchHost,operation,signIn};
}

async function provisionApp(db,ownerPersonId) {
  const now=Date.now();
  await db.batch([
    db.prepare(`INSERT INTO apps
      (app_id,workspace_id,name,slug,gateway_name,url,status,audience,active_release_id,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,'ready','workspace',NULL,?,?,?)`)
      .bind(appId,workspaceId,'Orders','orders','app-orders',appOrigin,ownerPersonId,now,now),
    db.prepare(`INSERT INTO releases
      (release_id,app_id,artifact_hash,artifact_key,runtime_name,manifest_json,actions_json,migrations_json,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(releaseId,appId,assetHash,`configs/${releaseId}.json`,'runtime',JSON.stringify(config.manifest),JSON.stringify(descriptors),'[]',ownerPersonId,now),
    db.prepare('INSERT INTO app_maintainers(app_id,person_id) VALUES(?,?)').bind(appId,ownerPersonId),
    db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,'orders.inspect'),
  ]);
  await db.batch([
    db.prepare('UPDATE apps SET active_release_id=? WHERE app_id=?').bind(releaseId,appId),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'live')")
      .bind(new URL(appOrigin).hostname,appId,releaseId),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'candidate')")
      .bind(new URL(candidateOrigin).hostname,appId,releaseId),
  ]);
}

async function addMember(api,owner,member) {
  const invited=await api.operation('members.invite',{
    workspaceId,
    email:member.person.email,
    role:'member',
  },owner.cookie);
  assert.equal(invited.response.status,200,JSON.stringify(invited.body));
  const accepted=await api.operation('members.accept',{
    invitationId:invited.body.result.invitation.id,
  },member.cookie);
  assert.equal(accepted.response.status,200,JSON.stringify(accepted.body));
}

test('a maintainer outside an empty live audience can sign in only to a candidate',{timeout:30000},async t=>{
  const api=await platform(t);
  const owner=await api.signIn('owner@example.com');
  const joinedAt=Date.now();
  await api.db.batch([
    api.db.prepare('INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)').bind(workspaceId,'Paper Company',workspaceId,owner.person.id,joinedAt),
    api.db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES(?,?,'owner','active',?)").bind(workspaceId,owner.person.id,joinedAt),
  ]);
  await provisionApp(api.db,owner.person.id);
  await api.db.prepare("UPDATE apps SET audience='selected' WHERE app_id=?").bind(appId).run();

  const candidateNavigation=await api.fetchHost(`${candidateOrigin}/review`,{headers:{accept:'text/html'}});
  assert.equal(candidateNavigation.status,302);
  const candidateDestination=new URL(candidateNavigation.headers.get('location'));
  const candidateState=candidateDestination.searchParams.get('state');
  const candidateLoginCookie=cookieValue(candidateNavigation.headers,'__Host-atrax_app_login');
  const candidateLogin=await api.operation('apps.login',{appId,state:candidateState,hostname:new URL(candidateOrigin).host},owner.cookie);
  assert.equal(candidateLogin.response.status,200,JSON.stringify(candidateLogin.body));
  const candidateCallback=await api.fetchHost(candidateLogin.body.result.redirectUrl,{headers:{cookie:candidateLoginCookie}});
  assert.equal(candidateCallback.status,302,await candidateCallback.clone().text());
  const candidateAppCookie=cookieValue(candidateCallback.headers,'__Host-atrax_app');
  assert.equal((await api.fetchHost(`${candidateOrigin}/`,{headers:{cookie:candidateAppCookie}})).status,200);

  const liveNavigation=await api.fetchHost(`${appOrigin}/`,{headers:{accept:'text/html'}});
  const liveDestination=new URL(liveNavigation.headers.get('location'));
  const liveLogin=await api.operation('apps.login',{appId,state:liveDestination.searchParams.get('state'),hostname:new URL(appOrigin).host},owner.cookie);
  assert.equal(liveLogin.response.status,403);
  assert.equal(liveLogin.body.error.code,'forbidden');
});

test('real control-plane login issues a host-only app session and rechecks current membership',{timeout:30000},async t=>{
  const api=await platform(t);
  const owner=await api.signIn('owner@example.com');
  const joinedAt=Date.now();
  await api.db.batch([
    api.db.prepare('INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)')
      .bind(workspaceId,'Paper Company',workspaceId,owner.person.id,joinedAt),
    api.db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES(?,?,'owner','active',?)")
      .bind(workspaceId,owner.person.id,joinedAt),
  ]);
  const member=await api.signIn('member@example.com');
  await addMember(api,owner,member);
  await provisionApp(api.db,owner.person.id);

  const navigation=await api.fetchHost(`${appOrigin}/orders/42?tab=open`,{
    headers:{accept:'text/html'},
  });
  assert.equal(navigation.status,302);
  const consoleLogin=new URL(navigation.headers.get('location'));
  assert.equal(consoleLogin.origin,consoleOrigin);
  assert.equal(consoleLogin.pathname,'/auth/app');
  assert.equal(consoleLogin.searchParams.get('appId'),appId);
  assert.equal(consoleLogin.searchParams.get('hostname'),new URL(appOrigin).host);
  const state=consoleLogin.searchParams.get('state');
  assert.match(state,/^[a-f0-9]{64}$/);
  const loginCookie=cookieValue(navigation.headers,'__Host-atrax_app_login');

  const unknownHost=await api.operation('apps.login',{
    appId,
    state,
    hostname:'wrong.atrax.test',
  },member.cookie);
  assert.equal(unknownHost.response.status,403);
  assert.equal(unknownHost.body.error.code,'forbidden');

  const candidateLogin=await api.operation('apps.login',{
    appId,
    state,
    hostname:new URL(candidateOrigin).host,
  },member.cookie);
  assert.equal(candidateLogin.response.status,403);
  assert.equal(candidateLogin.body.error.code,'forbidden');

  const authorized=await api.operation('apps.login',{
    appId,
    state,
    hostname:new URL(appOrigin).host,
  },member.cookie);
  assert.equal(authorized.response.status,200,JSON.stringify(authorized.body));
  const callback=new URL(authorized.body.result.redirectUrl);
  assert.equal(callback.origin,appOrigin);
  assert.equal(callback.pathname,'/__atrax/auth/callback');
  assert.equal(callback.searchParams.get('state'),state);

  const wrongState=new URL(callback);
  wrongState.searchParams.set('state','f'.repeat(64));
  const mismatched=await api.fetchHost(wrongState.href,{headers:{cookie:loginCookie}});
  assert.equal(mismatched.status,400);
  assert.equal((await mismatched.json()).error.code,'login_state_mismatch');

  const wrongHost=new URL(callback);
  wrongHost.host=new URL(candidateOrigin).host;
  const hostMismatch=await api.fetchHost(wrongHost.href,{headers:{cookie:loginCookie}});
  assert.equal(hostMismatch.status,400);
  assert.equal((await hostMismatch.json()).error.code,'invalid_code');

  const completed=await api.fetchHost(callback.href,{headers:{cookie:loginCookie}});
  assert.equal(completed.status,302,await completed.clone().text());
  assert.equal(completed.headers.get('location'),'/orders/42?tab=open');
  const appCookie=cookieValue(completed.headers,'__Host-atrax_app');
  const setCookies=completed.headers.getSetCookie?.() ?? [completed.headers.get('set-cookie')];
  const appSetCookie=setCookies.find((value)=>value.startsWith('__Host-atrax_app='));
  assert.match(appSetCookie,/; Path=\/; Secure; HttpOnly; SameSite=Lax;/);
  assert.equal(setCookies.some((value)=>value.startsWith('__Host-atrax_app_login=;')),true);
  assert.equal(setCookies.every((value)=>!/[; ]Domain=/i.test(value)),true);

  const asset=await api.fetchHost(`${appOrigin}/`,{headers:{cookie:appCookie}});
  assert.equal(asset.status,200,await asset.clone().text());
  assert.equal(await asset.text(),'<h1>Company orders</h1>');
  const action=await api.fetchHost(`${appOrigin}/__atrax/actions/orders.inspect`,{
    method:'POST',
    headers:{
      cookie:appCookie,
      origin:appOrigin,
      'content-type':'application/json',
    },
    body:JSON.stringify({orderId:'order-42'}),
  });
  const actionBody=await action.json();
  assert.equal(action.status,200,JSON.stringify(actionBody));
  assert.deepEqual(actionBody.result,{orderId:'order-42',actorId:member.person.id});

  const replay=await api.fetchHost(callback.href,{headers:{cookie:loginCookie}});
  assert.equal(replay.status,400);
  assert.equal((await replay.json()).error.code,'invalid_code');

  const recoveredMember=await api.signIn('member@example.com');
  const secondNavigation=await api.fetchHost(`${appOrigin}/second-session`,{
    headers:{accept:'text/html'},
  });
  const secondDestination=new URL(secondNavigation.headers.get('location'));
  const secondState=secondDestination.searchParams.get('state');
  const secondLoginCookie=cookieValue(secondNavigation.headers,'__Host-atrax_app_login');
  const secondAuthorized=await api.operation('apps.login',{
    appId,
    state:secondState,
    hostname:new URL(appOrigin).host,
  },recoveredMember.cookie);
  assert.equal(secondAuthorized.response.status,200,JSON.stringify(secondAuthorized.body));
  const secondCompleted=await api.fetchHost(secondAuthorized.body.result.redirectUrl,{
    headers:{cookie:secondLoginCookie},
  });
  assert.equal(secondCompleted.status,302,await secondCompleted.clone().text());
  const secondAppCookie=cookieValue(secondCompleted.headers,'__Host-atrax_app');
  const revokedParent=await api.operation('auth.session.revoke',{
    sessionId:recoveredMember.session.id,
  },recoveredMember.cookie);
  assert.equal(revokedParent.response.status,200,JSON.stringify(revokedParent.body));
  const parentDenied=await api.fetchHost(`${appOrigin}/`,{headers:{cookie:secondAppCookie}});
  assert.equal(parentDenied.status,401);
  assert.equal((await parentDenied.json()).error.code,'unauthorized');

  const removed=await api.operation('members.remove',{
    workspaceId,
    personId:member.person.id,
  },owner.cookie);
  assert.equal(removed.response.status,200,JSON.stringify(removed.body));
  const denied=await api.fetchHost(`${appOrigin}/`,{
    headers:{cookie:appCookie,accept:'text/html'},
  });
  assert.equal(denied.status,403);
  assert.equal((await denied.json()).error.code,'forbidden');
});
