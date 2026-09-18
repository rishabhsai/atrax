import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import {createSecretsPlatform as platform} from './helpers/secrets-platform.mjs';

const signature=value=>createHmac('sha256',value).update('verify shared credential').digest('hex');

test('encrypted shared credentials rotate and revoke in live app actions without redeploying',async t=>{
  const api=await platform(t),value='private-key-v1-keep-out-of-responses',rotated='private-key-v2-keep-out-of-responses';
  assert.equal((await api.call('secrets.create',{name:'Signing',value},'member')).status,403);
  const created=await api.okay('secrets.create',{name:'Signing',description:'Signing service',value},'owner','create-key');
  const id=created.secret.id;
  assert.equal(JSON.stringify(created).includes(value),false);
  const stored=await api.db.prepare('SELECT * FROM workspace_secrets WHERE secret_id=?').bind(id).first();
  assert.ok(stored.ciphertext&&!stored.ciphertext.includes(value));assert.equal(Buffer.from(stored.iv,'base64').length,12);
  const granted=await api.okay('secrets.setApps',{secretId:id,baseRevision:1,apps:[{appId:'signer',bindingName:'SIGNING_KEY'},{appId:'other',bindingName:'SIGNING_KEY'}]});
  assert.equal(granted.secret.revision,2);
  for(const app of ['signer','other']) assert.equal((await api.sign({app})).body.result.signature,signature(value));
  const preview=await api.sign({person:'owner',preview:true});assert.equal(preview.status,403,JSON.stringify(preview.body));
  assert.equal((await api.sign({binding:'UNGRANTED'})).status,403);
  assert.equal((await api.call('secrets.list',{},'member')).status,403);
  assert.equal((await api.call('secrets.list',{},'outsider')).status,403);
  assert.equal((await api.call('secrets.get',{secretId:id})).status,404);
  const update={secretId:id,baseRevision:2,value:rotated};
  const rotations=await Promise.all(Array.from({length:6},()=>api.call('secrets.rotate',update,'owner','rotate-key')));
  for(const response of rotations) assert.equal(response.status,200,JSON.stringify(response.body));
  assert.ok(rotations.every(response=>response.result.secret.revision===3));
  for(const app of ['signer','other']) assert.equal((await api.sign({app})).body.result.signature,signature(rotated));
  assert.equal((await api.call('secrets.rotate',{...update,value:'different'},'owner','rotate-key')).body.error.code,'idempotency_conflict');
  assert.equal((await api.call('secrets.rotate',update)).body.error.code,'revision_conflict');
  await api.okay('secrets.setApps',{secretId:id,baseRevision:3,apps:[{appId:'signer',bindingName:'SIGNING_KEY'}]});
  assert.equal((await api.sign({app:'other'})).status,403);
  await api.db.prepare("INSERT INTO action_denials(app_id,action_name,person_id) VALUES('signer','signing.sign','member')").run();
  assert.equal((await api.sign()).status,403);
  await api.db.prepare("DELETE FROM action_denials WHERE app_id='signer'").run();
  await api.okay('secrets.revoke',{secretId:id,baseRevision:4});
  assert.equal((await api.sign()).status,403);
  const revoked=await api.db.prepare('SELECT ciphertext,iv FROM workspace_secrets WHERE secret_id=?').bind(id).first();assert.deepEqual(revoked,{ciphertext:null,iv:null});
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM secret_app_grants').first()).count,0);
  await api.okay('secrets.rotate',update,'owner','rotate-key');assert.equal((await api.sign()).status,403);
  const receipts=(await api.db.prepare('SELECT * FROM secret_operation_receipts').all()).results;
  const activity=await api.okay('activity.list');
  for(const output of [JSON.stringify(receipts),JSON.stringify(activity),JSON.stringify(await api.okay('secrets.list'))]) for(const secretValue of [value,rotated]) assert.equal(output.includes(secretValue),false);
  assert.ok(activity.events.some(event=>event.operation==='secrets.rotate'&&event.agentLabel==='Secrets test agent'));
  await api.db.prepare("UPDATE workspace_members SET role='member' WHERE person_id='owner' AND workspace_id='company'").run();
  assert.equal((await api.call('secrets.create',{name:'Signing',description:'Signing service',value},'owner','create-key')).status,403);
});

test('CLI stdin and MCP share administrator operations, metadata responses, and retry rules',async t=>{
  const api=await platform(t),value='stdin credential with a trailing newline\n';
  const created=await api.run('owner',['secrets','create','Payments','--stdin','--key','cli-create'],value);
  assert.equal(created.code,0,created.stdout);assert.equal(created.stdout.includes(value),false);assert.equal(created.stderr.includes(value),false);
  const id=created.body.result.secret.id;
  const argumentWrite=await api.run('owner',['call','secrets.create','--input',JSON.stringify({workspaceId:'company',name:'Argument',value:'argument-value'})]);
  assert.equal(argumentWrite.code,1);assert.equal(argumentWrite.stdout.includes('argument-value'),false);
  const streamedWrite=await api.run('owner',['call','secrets.create','--stdin'],JSON.stringify({workspaceId:'company',name:'Streamed',value:'streamed-value'}));
  assert.equal(streamedWrite.code,0,streamedWrite.stdout);assert.equal(streamedWrite.stdout.includes('streamed-value'),false);
  const malformed=await api.run('owner',['call','secrets.create','--stdin'],'{"value":"malformed-credential-value" BROKEN');
  assert.equal(malformed.code,1);assert.equal(`${malformed.stdout}${malformed.stderr}`.includes('malformed-credential-value'),false);
  const retry=await api.run('owner',['secrets','create','Payments','--stdin','--key','cli-create'],value);assert.equal(retry.body.result.secret.id,id);
  assert.equal((await api.run('owner',['secrets','rotate',id,'--revision','1','plaintext-value'])).code,1);
  const client=await api.mcp('owner'),member=await api.mcp('member');
  const tools=(await client.listTools()).tools.map(tool=>tool.name);assert.ok(tools.includes('atrax_secrets_setApps'));assert.equal(tools.includes('atrax_secrets_get'),false);
  const grant=await client.callTool({name:'atrax_secrets_setApps',arguments:{input:{workspaceId:'company',secretId:id,baseRevision:1,apps:[{appId:'signer',bindingName:'SIGNING_KEY'}]},key:'mcp-grant'}});
  assert.equal(grant.isError,undefined,JSON.stringify(grant));assert.equal((await api.sign()).body.result.signature,signature(value));
  const denied=await member.callTool({name:'atrax_secrets_list',arguments:{workspaceId:'company'}});assert.equal(denied.structuredContent.error.code,'forbidden');
  const updated=await api.run('owner',['secrets','update',id,'--revision','2','--name','Signer','--description','Shared signing credential']);assert.equal(updated.code,0,updated.stdout);
  const changed=await api.run('owner',['secrets','rotate',id,'--revision','3','--stdin'],'replacement-value');assert.equal(changed.code,0,changed.stdout);assert.equal((await api.sign()).body.result.signature,signature('replacement-value'));
  const revoke=await client.callTool({name:'atrax_secrets_revoke',arguments:{input:{workspaceId:'company',secretId:id,baseRevision:4},key:'mcp-revoke'}});assert.equal(revoke.isError,undefined,JSON.stringify(revoke));assert.equal((await api.sign()).status,403);
});

test('credential grants reject workspace escapes and collisions; mutations serialize by revision',async t=>{
  const api=await platform(t);
  const first=(await api.okay('secrets.create',{name:'First',value:'first-key'})).secret;
  const second=(await api.okay('secrets.create',{name:'Second',value:'second-key'})).secret;
  const grant={secretId:first.id,baseRevision:1,apps:[{appId:'signer',bindingName:'SIGNING_KEY'}]};
  await api.okay('secrets.setApps',grant);
  const collision=await api.call('secrets.setApps',{...grant,secretId:second.id});assert.equal(collision.status,409);
  assert.equal((await api.sign()).body.result.signature,signature('first-key'));
  assert.equal((await api.call('secrets.setApps',{...grant,secretId:second.id,apps:[{appId:'signer',bindingName:'SECOND'},{appId:'signer',bindingName:'THIRD'}]})).status,400);
  await api.db.prepare("UPDATE apps SET workspace_id='elsewhere' WHERE app_id='other'").run();
  assert.equal((await api.call('secrets.setApps',{secretId:second.id,baseRevision:1,apps:[{appId:'other',bindingName:'OTHER_KEY'}]})).status,409);
  const attempts=await Promise.all([
    api.call('secrets.update',{secretId:first.id,baseRevision:2,name:'Renamed',description:''}),
    api.call('secrets.rotate',{secretId:first.id,baseRevision:2,value:'changed-key'}),
  ]);
  assert.deepEqual(attempts.map(result=>result.status).sort(),[200,409]);
  assert.equal((await api.okay('secrets.list')).secrets.find(secret=>secret.id===first.id).revision,3);
  await api.db.prepare("UPDATE sessions SET revoked_at=? WHERE session_id='member-session'").bind(Date.now()).run();
  assert.equal((await api.sign()).status,401);
  await api.db.prepare("UPDATE workspace_members SET status='removed' WHERE workspace_id='company' AND person_id='owner'").run();
  assert.equal((await api.call('secrets.setApps',grant)).status,403);
});

test('ciphertext corruption fails without returning credential data',async t=>{
  const api=await platform(t),value='never-return-this-value';
  const first=(await api.okay('secrets.create',{name:'Corruption',value})).secret;
  await api.okay('secrets.setApps',{secretId:first.id,baseRevision:1,apps:[{appId:'signer',bindingName:'SIGNING_KEY'}]});
  await api.db.prepare('UPDATE workspace_secrets SET ciphertext=? WHERE secret_id=?').bind(Buffer.from('invalid ciphertext').toString('base64'),first.id).run();
  const response=await api.sign();assert.equal(response.status,503,JSON.stringify(response.body));assert.equal(response.body.error.code,'secrets_unavailable');assert.equal(JSON.stringify(response.body).includes(value),false);
  const invalid=await api.call('secrets.create',{name:'Invalid',value,unknown:value});assert.equal(invalid.status,400);assert.equal(JSON.stringify(invalid.body).includes(value),false);
});


test('missing master key rejects credential writes without storing values or receipts',async t=>{
  const api=await platform(t,{encryptionKey:''});
  const response=await api.call('secrets.create',{name:'Missing key',value:'never-store-without-encryption'});
  assert.equal(response.status,503);assert.equal(response.body.error.code,'secrets_unavailable');
  assert.equal(JSON.stringify(response.body).includes('never-store-without-encryption'),false);
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM workspace_secrets').first()).count,0);
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM secret_operation_receipts').first()).count,0);
});
