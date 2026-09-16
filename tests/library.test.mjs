import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane,localMailboxSource} from '../cli/local-platform.mjs';

// Identities are local fixture state; every behavior assertion uses the actual HTTP API.
async function platform(t) {
  const mf=new Miniflare({workers:[
    localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
      CP_DB:{type:'d1',id:'library-test-db'},
      CONSOLE_ORIGIN:{type:'json',value:'https://console.atrax.test'},
      EMAIL_FROM:{type:'json',value:'test@atrax.test'},
      EMAIL:{type:'worker',worker:'mailbox',exportName:'Mail'},
    }),localWorker('mailbox',localMailboxSource),
    localWorker('library-caller','export default {async fetch(request,env){return Response.json(await env.LIBRARY.invoke(await request.json()));}}',{
      LIBRARY:{type:'worker',worker:'control-plane',exportName:'Library'},
    }),
  ]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const tokens={};
  const now=Date.now();
  for(const name of ['owner','member','outsider']) {
    const token=crypto.randomUUID().replaceAll('-','').repeat(2);
    tokens[name]=token;
    await db.batch([
      db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(name,`${name}@example.com`,now,now),
      db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,created_at,expires_at) VALUES(?,?,?,'cli',?,?)").bind(`${name}-session`,name,createHash('sha256').update(token).digest('hex'),now,now+3600000),
    ]);
  }
  await db.batch([
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)").bind(now,now),
  ]);
  async function call(operation,input={},person='owner',key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${operation}`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[person]}`,'Idempotency-Key':key},
      body:JSON.stringify({workspaceId:'company',...input}),
    });
    const body=await response.json();
    return {status:response.status,body,result:body.result};
  }
  async function okay(operation,input={},person='owner',key) {
    const response=await call(operation,input,person,key);
    assert.equal(response.status,200,JSON.stringify(response.body));
    return response.result;
  }
  return {call,okay,db,mf,tokens};
}

test('members contribute, correct, search current guidance, and retain attributed history',async t=>{
  const api=await platform(t);
  const first=await api.okay('library.entry.create',{title:'Shipping guide',text:'Ship parcels with Bluebird.'},'member','create-guide');
  assert.equal(first.item.kind,'knowledge');
  assert.equal(first.item.audience,'workspace');
  assert.equal(first.revision.number,1);
  assert.equal(first.revision.author.personId,'member');
  const retry=await api.okay('library.entry.create',{title:'Shipping guide',text:'Ship parcels with Bluebird.'},'member','create-guide');
  assert.equal(retry.item.id,first.item.id);
  assert.equal((await api.okay('library.list')).items.length,1);
  assert.equal((await api.okay('library.search',{query:'Bluebird'})).items[0].revisionId,first.revision.id);
  const corrected=await api.okay('library.entry.revise',{
    itemId:first.item.id,baseRevisionId:first.revision.id,text:'Ship parcels with Greenbird.',reason:'Carrier contract changed',
  },'owner','correct-guide');
  assert.equal(corrected.revision.number,2);
  assert.equal(corrected.revision.title,'Shipping guide');
  assert.equal(corrected.revision.author.personId,'owner');
  assert.equal((await api.okay('library.search',{query:'Bluebird'})).items.length,0);
  assert.equal((await api.okay('library.search',{query:'Greenbird'})).items[0].revisionId,corrected.revision.id);
  const history=await api.okay('library.history',{itemId:first.item.id},'member');
  assert.deepEqual(history.revisions.map(revision=>revision.id),[corrected.revision.id,first.revision.id]);
  assert.equal(history.revisions[0].reason,'Carrier contract changed');
  const original=await api.okay('library.get',{itemId:first.item.id,revisionId:first.revision.id},'member');
  assert.equal(original.revision.text,'Ship parcels with Bluebird.');
  const stale=await api.call('library.entry.revise',{itemId:first.item.id,baseRevisionId:first.revision.id,text:'Obsolete advice',reason:'Stale edit'});
  assert.equal(stale.status,409);
  assert.equal(stale.body.error.code,'revision_conflict');
  assert.equal(stale.body.error.details.currentRevisionId,corrected.revision.id);
});

test('current source audiences protect search, exact revisions, history, and write replays',async t=>{
  const api=await platform(t);
  const source=await api.okay('library.entry.create',{title:'Confidential carrier costs',text:'Bluebird secret rate is twenty.'});
  const derivedInput={title:'Bluebird purchasing advice',text:'Bluebird secret rate makes this our preferred carrier.',sourceRevisions:[{itemId:source.item.id,revisionId:source.revision.id}]};
  const derived=await api.okay('library.entry.create',derivedInput,'member','derive-carrier');
  const publicEntry=await api.okay('library.entry.create',{title:'Bluebird public address',text:'Bluebird accepts parcels on Main Street.'});
  await api.okay('library.setAccess',{itemId:source.item.id,audience:'selected',personIds:['owner']});
  for(const operation of ['library.get','library.history']) {
    assert.equal((await api.call(operation,{itemId:source.item.id},'member')).status,404);
    assert.equal((await api.call(operation,{itemId:derived.item.id},'member')).status,404);
  }
  const search=await api.okay('library.search',{query:'Bluebird',limit:1},'member');
  assert.deepEqual(search.items.map(item=>item.id),[publicEntry.item.id]);
  assert.equal(JSON.stringify(search).includes('secret'),false);
  assert.deepEqual((await api.okay('library.list',{},'member')).items.map(item=>item.id),[publicEntry.item.id]);
  assert.equal((await api.call('library.entry.create',derivedInput,'member','derive-carrier')).status,404);
  const exact=await api.okay('library.get',{itemId:derived.item.id});
  assert.deepEqual(exact.revision.sourceRevisions,derivedInput.sourceRevisions);
  const independent=await api.okay('library.entry.revise',{
    itemId:derived.item.id,baseRevisionId:derived.revision.id,title:'General carrier advice',text:'Choose the carrier listed on each order.',reason:'Use order-specific advice',sourceRevisions:[],
  });
  const memberHistory=await api.okay('library.history',{itemId:derived.item.id},'member');
  assert.deepEqual(memberHistory.revisions.map(revision=>revision.id),[independent.revision.id]);
  assert.equal((await api.call('library.get',{itemId:derived.item.id,revisionId:derived.revision.id},'member')).status,404);
  assert.equal(JSON.stringify(memberHistory).includes('secret'),false);
  assert.equal((await api.okay('library.history',{itemId:derived.item.id})).revisions.length,2);
});

test('source graphs reject cycles and preserve provenance when a correction omits sources',async t=>{
  const api=await platform(t);
  const first=await api.okay('library.entry.create',{title:'Operating policy',text:'Contact logistics first.'});
  const refs=[{itemId:first.item.id,revisionId:first.revision.id}];
  const second=await api.okay('library.entry.create',{title:'Shipping policy',text:'Logistics selects the shipper.',sourceRevisions:refs});
  const corrected=await api.okay('library.entry.revise',{itemId:second.item.id,baseRevisionId:second.revision.id,text:'Logistics selects the carrier.',reason:'Terminology'});
  assert.deepEqual(corrected.revision.sourceRevisions,refs);
  const cycle=await api.call('library.entry.revise',{itemId:first.item.id,baseRevisionId:first.revision.id,text:'Follow shipping policy.',reason:'Reference shipping',sourceRevisions:[{itemId:second.item.id,revisionId:corrected.revision.id}]});
  assert.equal(cycle.status,409);
  assert.equal(cycle.body.error.code,'source_cycle');
  const wrongPair=await api.call('library.entry.create',{title:'Bad source',text:'Source item and revision must match.',sourceRevisions:[{itemId:first.item.id,revisionId:second.revision.id}]});
  assert.equal(wrongPair.status,404);
  assert.equal((await api.okay('library.history',{itemId:first.item.id})).revisions.length,1);
});

test('concurrent corrections preserve one successor and identical retries preserve one contribution',async t=>{
  const api=await platform(t);
  const input={title:'Returns policy',text:'Return goods within ten days.'};
  const duplicates=await Promise.all([api.call('library.entry.create',input,'member','same-command'),api.call('library.entry.create',input,'member','same-command')]);
  assert.deepEqual(duplicates.map(value=>value.status),[200,200]);
  assert.equal(duplicates[0].result.item.id,duplicates[1].result.item.id);
  const first=duplicates[0].result;
  assert.equal((await api.call('library.entry.create',{...input,text:'Different command'},'member','same-command')).body.error.code,'idempotency_conflict');
  const corrections=[
    {itemId:first.item.id,baseRevisionId:first.revision.id,text:'Return goods within twenty days.',reason:'New contract'},
    {itemId:first.item.id,baseRevisionId:first.revision.id,text:'Return goods within thirty days.',reason:'New contract'},
  ];
  const outcomes=await Promise.all(corrections.map((input,index)=>api.call('library.entry.revise',input,'member',`correct-${index}`)));
  assert.deepEqual(outcomes.map(value=>value.status).sort(),[200,409]);
  const winner=outcomes.findIndex(value=>value.status===200);
  const replay=await api.okay('library.entry.revise',corrections[winner],'member',`correct-${winner}`);
  assert.equal(replay.revision.id,outcomes[winner].result.revision.id);
  const history=await api.okay('library.history',{itemId:first.item.id});
  assert.equal(history.revisions.length,2);
  assert.equal(history.revisions[0].id,replay.revision.id);
  const search=await api.okay('library.search',{query:'goods'});
  assert.equal(search.items.length,1);
  assert.equal(search.items[0].revisionId,replay.revision.id);
});

test('a failed D1 write rolls back its revision, receipt, current pointer, and search index',async t=>{
  const api=await platform(t);
  const first=await api.okay('library.entry.create',{title:'Delivery',text:'Original guidance.'});
  // A database-level fault exercises the real batch rollback, not mocked SQL calls.
  await api.db.prepare("CREATE TRIGGER inject_revision_failure BEFORE INSERT ON library_revisions WHEN NEW.body_text='Replacement guidance.' BEGIN SELECT RAISE(ABORT,'injected revision failure'); END").run();
  const correction={itemId:first.item.id,baseRevisionId:first.revision.id,text:'Replacement guidance.',reason:'Correct the guidance'};
  const failed=await api.call('library.entry.revise',correction,'owner','retry-failed-write');
  assert.equal(failed.status,500);
  assert.equal((await api.okay('library.get',{itemId:first.item.id})).revision.id,first.revision.id);
  assert.equal((await api.okay('library.search',{query:'Original'})).items.length,1);
  assert.equal((await api.okay('library.search',{query:'Replacement'})).items.length,0);
  await api.db.prepare('DROP TRIGGER inject_revision_failure').run();
  const retried=await api.okay('library.entry.revise',correction,'owner','retry-failed-write');
  assert.equal(retried.revision.number,2);
  assert.equal((await api.okay('library.history',{itemId:first.item.id})).revisions.length,2);
  assert.equal((await api.okay('library.search',{query:'Replacement'})).items[0].revisionId,retried.revision.id);
});

test('archive retains history, while membership and item audience govern every operation',async t=>{
  const api=await platform(t);
  const entry=await api.okay('library.entry.create',{title:'Obsolete handbook',text:'Retired procedures.'});
  assert.equal((await api.call('library.archive',{itemId:entry.item.id},'member')).status,403);
  assert.equal((await api.call('library.setAccess',{itemId:entry.item.id,audience:'selected',personIds:['member']},'member')).status,403);
  for(const operation of ['library.list','library.search','library.get','library.history']) {
    const input=operation==='library.search' ? {query:'handbook'} : ['library.get','library.history'].includes(operation) ? {itemId:entry.item.id} : {};
    assert.equal((await api.call(operation,input,'outsider')).status,403);
  }
  assert.equal((await api.call('library.entry.create',{title:'Outside',text:'No workspace membership.'},'outsider')).status,403);
  await api.okay('library.archive',{itemId:entry.item.id});
  assert.equal((await api.okay('library.list')).items.length,0);
  assert.equal((await api.okay('library.search',{query:'Retired'})).items.length,0);
  assert.equal((await api.okay('library.get',{itemId:entry.item.id})).item.status,'archived');
  assert.equal((await api.okay('library.history',{itemId:entry.item.id})).revisions.length,1);
  assert.equal((await api.call('library.entry.revise',{itemId:entry.item.id,baseRevisionId:entry.revision.id,text:'Cannot edit archived item.',reason:'Attempt'})).body.error.code,'invalid_state');
  const removed=await api.mf.dispatchFetch('https://api.atrax.test/v1/operations/members.remove',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${api.tokens.owner}`,'Idempotency-Key':'remove-member'},body:JSON.stringify({workspaceId:'company',personId:'member'}),
  });
  assert.equal(removed.status,200);
  assert.equal((await api.call('library.list',{},'member')).status,403);
  assert.equal((await api.call('library.get',{itemId:entry.item.id},'member')).status,403);
});

test('Library RPC derives employee identity and workspace from the live parent, denying guests and expired calls',async t=>{
  const api=await platform(t);
  const now=Date.now();
  await api.db.batch([
    api.db.prepare("UPDATE sessions SET kind='agent',agent_label='Logistics assistant' WHERE session_id='member-session'"),
    api.db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at) VALUES('orders','company','Orders','orders','orders-gateway','https://orders.atrax.test','ready','workspace','owner',?,?)").bind(now,now),
    api.db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES('release','orders','hash','key','{}','[]','[]','owner',?)").bind(now),
    api.db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES('orders','knowledge.read','workspace')"),
    api.db.prepare("INSERT INTO app_guests(app_id,person_id) VALUES('orders','outsider')"),
    api.db.prepare("INSERT INTO action_people(app_id,action_name,person_id) VALUES('orders','knowledge.read','outsider')"),
    ...['member','outsider'].map(person=>api.db.prepare("INSERT INTO invocations(invocation_id,root_invocation_id,session_id,person_id,app_id,release_id,action_name,depth,status,started_at,expires_at) VALUES(?,?,?,?,'orders','release','knowledge.read',0,'running',?,?)").bind(`${person}-invocation`,`${person}-invocation`,`${person}-session`,person,now,now+30000)),
  ]);
  const caller=await api.mf.getWorker('library-caller');
  async function invoke(operation,input={},extra={}) {
    return (await caller.fetch('https://library-caller.test',{
      method:'POST',body:JSON.stringify({parentInvocationId:'member-invocation',sourceAppId:'orders',operation,input,...extra}),
    })).json();
  }
  const contribution={title:'Orders reference',text:'Check delivery terms before dispatch.'};
  const created=await invoke('library.entry.create',contribution,{idempotencyKey:'agent-contribution'});
  assert.equal(created.ok,true,JSON.stringify(created));
  assert.equal(created.result.item.workspaceId,'company');
  assert.equal(created.result.revision.author.personId,'member');
  assert.equal(created.result.revision.author.kind,'agent');
  assert.equal(created.result.revision.author.agentLabel,'Logistics assistant');
  const retry=await invoke('library.entry.create',contribution,{idempotencyKey:'agent-contribution'});
  assert.equal(retry.result.item.id,created.result.item.id);
  assert.equal((await invoke('library.entry.create',contribution)).error.code,'idempotency_key_required');
  assert.equal((await invoke('library.get',{workspaceId:'other-company',itemId:created.result.item.id})).error.code,'forbidden');
  assert.equal((await invoke('library.search',{query:'delivery',actor:{person:{id:'owner'}}})).error.code,'invalid_input');
  assert.equal((await invoke('library.search',{query:'delivery'},{parentInvocationId:'outsider-invocation'})).error.code,'forbidden');
  assert.equal((await invoke('library.setAccess',{itemId:created.result.item.id,audience:'workspace'})).error.code,'forbidden');
  const found=await invoke('library.search',{query:'delivery'});
  assert.equal(found.result.items[0].id,created.result.item.id);
  await api.db.prepare("UPDATE invocations SET status='succeeded',finished_at=? WHERE invocation_id='member-invocation'").bind(Date.now()).run();
  assert.equal((await invoke('library.search',{query:'delivery'})).error.code,'forbidden');
  assert.equal((await invoke('library.entry.create',contribution,{idempotencyKey:'agent-contribution'})).error.code,'forbidden');
});
