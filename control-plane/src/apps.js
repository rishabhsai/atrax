import {getApp,requireMembership,requireMaintainer,requireMaintainerAssignmentAuthority,assertAppAccess,assertActionAccess} from './access.js';
import {OperationError} from './identity-errors.js';
import {hashSecret,randomSecret} from './identity.js';
import {canonicalJson,validateName} from '../../shared/app-contract.js';
import {getAppOperations} from './app-operations.js';

export function appView(row) {return {id:row.app_id,workspaceId:row.workspace_id,name:row.name,slug:row.slug,url:row.url,status:row.status,audience:row.audience,activeReleaseId:row.active_release_id,createdAt:row.created_at,updatedAt:row.updated_at};}
export async function actorStillAuthorized(env,actor,workspaceId) {
  const row=await env.CP_DB.prepare(`SELECT 1 FROM sessions s JOIN workspace_members m ON m.person_id=s.person_id WHERE s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND m.workspace_id=? AND m.status='active'`).bind(actor.session.id,Date.now(),workspaceId).first();
  if(!row) throw new OperationError('forbidden',403,'Your workspace access has ended');
}
async function create(input,{env,actor,idempotencyKey}) {
  await requireMembership(env,input.workspaceId,actor);
  if(typeof idempotencyKey!=='string'||!idempotencyKey||idempotencyKey.length>200) throw new OperationError('idempotency_key_required',400,'App creation requires an idempotency key');
  try {validateName(input.slug);} catch(error) {throw new OperationError('invalid_input',400,error.message);}
  const name=input.name.trim();
  if(!name||name.length>100) throw new OperationError('invalid_input',400,'App name must contain 1–100 characters');
  const inputHash=await hashSecret(canonicalJson({...input,name}));
  const receipt=await env.CP_DB.prepare("SELECT * FROM operation_receipts WHERE person_id=? AND operation='apps.create' AND target_id=? AND idempotency_key=?").bind(actor.person.id,input.workspaceId,idempotencyKey).first();
  if(receipt) {
    await actorStillAuthorized(env,actor,input.workspaceId);
    if(receipt.input_hash!==inputHash) throw new OperationError('idempotency_conflict',409,'This key was used for different app details');
    return {result:JSON.parse(receipt.result_json)};
  }
  const appId=crypto.randomUUID();
  const operationId=crypto.randomUUID();
  const now=Date.now();
  const gatewayName=`app-${appId.replaceAll('-','')}`;
  const url=`https://${input.slug}-${appId.slice(0,8)}.${env.APP_DOMAIN ?? 'atrax.run'}`;
  const app={id:appId,workspaceId:input.workspaceId,name,slug:input.slug,url,status:'created',audience:'workspace',activeReleaseId:null,createdAt:now,updatedAt:now};
  const result={app,capabilities:{canOpen:true,maintain:true,manageAccess:true,canManageMaintainers:true}};
  const guard='EXISTS(SELECT 1 FROM operation_receipts WHERE operation_id=?)';
  try {
    await env.CP_DB.batch([
      env.CP_DB.prepare(`INSERT INTO operation_receipts(operation_id,person_id,operation,target_id,idempotency_key,input_hash,result_json,created_at)
        SELECT ?,?,'apps.create',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.person_id=s.person_id WHERE s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND m.workspace_id=? AND m.status='active') ON CONFLICT DO NOTHING`).bind(operationId,actor.person.id,input.workspaceId,idempotencyKey,inputHash,JSON.stringify(result),now,actor.session.id,now,input.workspaceId),
      env.CP_DB.prepare(`INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at) SELECT ?,?,?,?,?,?,'created','workspace',?,?,? WHERE ${guard}`).bind(appId,input.workspaceId,name,input.slug,gatewayName,url,actor.person.id,now,now,operationId),
      env.CP_DB.prepare(`INSERT INTO app_hosts(hostname,app_id,kind) SELECT ?,?,'live' WHERE ${guard}`).bind(new URL(url).hostname,appId,operationId),
      env.CP_DB.prepare(`INSERT INTO app_maintainers(app_id,person_id) SELECT ?,? WHERE ${guard}`).bind(appId,actor.person.id,operationId),
      env.CP_DB.prepare(`INSERT INTO activity(activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,created_at) SELECT ?,?,?,?,'apps.create',?,'succeeded',? WHERE ${guard}`).bind(crypto.randomUUID(),input.workspaceId,actor.person.id,actor.session.id,appId,now,operationId),
    ]);
  } catch(error) {
    if(String(error.message).includes('UNIQUE constraint failed: apps.workspace_id, apps.slug')) throw new OperationError('app_slug_taken',409,'An app already uses this name in the workspace');
    throw error;
  }
  const committed=await env.CP_DB.prepare("SELECT * FROM operation_receipts WHERE person_id=? AND operation='apps.create' AND target_id=? AND idempotency_key=?").bind(actor.person.id,input.workspaceId,idempotencyKey).first();
  if(!committed) throw new OperationError('forbidden',403,'Your workspace access changed before the app was created');
  if(committed.input_hash!==inputHash) throw new OperationError('idempotency_conflict',409,'This key was used for different app details');
  return {result:JSON.parse(committed.result_json)};
}
async function list(input,{env,actor}) {
  await requireMembership(env,input.workspaceId,actor);
  const rows=await env.CP_DB.prepare(`SELECT a.*,
    (a.audience!='selected' OR EXISTS(SELECT 1 FROM app_people p WHERE p.app_id=a.app_id AND p.person_id=?)) AS can_open,
    EXISTS(SELECT 1 FROM app_maintainers m WHERE m.app_id=a.app_id AND m.person_id=?) AS can_maintain,
    (EXISTS(SELECT 1 FROM app_maintainers m WHERE m.app_id=a.app_id AND m.person_id=?) OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=a.workspace_id AND m.person_id=? AND m.status='active' AND m.role IN ('owner','admin'))) AS can_manage_maintainers
    FROM apps a WHERE workspace_id=? AND status!='deleted' AND (
      a.audience!='selected'
      OR EXISTS(SELECT 1 FROM app_people p WHERE p.app_id=a.app_id AND p.person_id=?)
      OR EXISTS(SELECT 1 FROM app_maintainers m WHERE m.app_id=a.app_id AND m.person_id=?)
      OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=a.workspace_id AND m.person_id=? AND m.status='active' AND m.role IN ('owner','admin'))
    ) ORDER BY name`).bind(actor.person.id,actor.person.id,actor.person.id,actor.person.id,input.workspaceId,actor.person.id,actor.person.id,actor.person.id).all();
  return {result:{apps:rows.results.map(row=>({...appView(row),canOpen:!!row.can_open,canMaintain:!!row.can_maintain,canManageMaintainers:!!row.can_manage_maintainers}))}};
}
async function get(input,{env,actor}) {
  const app=await getApp(env,input.appId);
  let maintain=false;
  try {await requireMaintainer(env,app,actor);maintain=true;} catch(error) {if(error.code!=='forbidden') throw error;}
  let canManageMaintainers=maintain;
  if(!canManageMaintainers) {
    try {await requireMaintainerAssignmentAuthority(env,app,actor);canManageMaintainers=true;} catch(error) {if(error.code!=='forbidden') throw error;}
  }
  let access=null;
  try {access=await assertAppAccess(env,app,actor);} catch(error) {if(error.code!=='forbidden' || !canManageMaintainers) throw error;}
  const release=(access||maintain) && app.active_release_id ? await env.CP_DB.prepare('SELECT release_id,artifact_hash,created_at,actions_json FROM releases WHERE release_id=?').bind(app.active_release_id).first() : null;
  let actions;
  if(release) {
    const descriptors=JSON.parse(release.actions_json);
    if(maintain) actions=descriptors;
    else {
      actions=[];
      for(const descriptor of descriptors) {
        try {
          await assertActionAccess(env,app,descriptor.name,actor,access);
          actions.push(descriptor);
        } catch(error) {
          if(![403,404].includes(error.status)) throw error;
        }
      }
    }
  }
  return {result:{app:appView(app),capabilities:{canOpen:!!access,maintain,manageAccess:maintain,canManageMaintainers},...(release ? {release:{id:release.release_id,hash:release.artifact_hash,createdAt:release.created_at,actions}} : {})}};
}
async function login(input,{env,actor}) {
  if(actor.session.kind!=='browser') throw new OperationError('forbidden',403,'Open this app from a signed-in browser');
  const app=await getApp(env,input.appId);
  const code=randomSecret();
  const hostname=input.hostname ?? new URL(app.url).host;
  const host=await env.CP_DB.prepare('SELECT * FROM app_hosts WHERE hostname=? AND app_id=? AND active=1').bind(hostname,app.app_id).first();
  if(!host) throw new OperationError('forbidden',403,'App host is not registered');
  if(host.kind!=='live') await requireMaintainer(env,app,actor);
  else await assertAppAccess(env,app,actor);
  const callback=new URL('/__atrax/auth/callback',`${new URL(app.url).protocol}//${hostname}`);
  await env.CP_DB.prepare('INSERT INTO app_login_codes(code_hash,app_id,session_id,state_hash,callback,expires_at) VALUES(?,?,?,?,?,?)').bind(await hashSecret(code),app.app_id,actor.session.id,await hashSecret(input.state),callback.href,Date.now()+60_000).run();
  callback.searchParams.set('code',code);callback.searchParams.set('state',input.state);
  return {result:{redirectUrl:callback.href}};
}
export async function handleAppOperation(name,input,context) {
  if(name==='apps.create') return create(input,context);
  if(name==='apps.list') return list(input,context);
  if(name==='apps.get') return get(input,context);
  if(name==='apps.operations.get') return getAppOperations(input,context);
  if(name==='apps.login') return login(input,context);
  return null;
}
