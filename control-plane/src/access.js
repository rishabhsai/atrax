import {WorkerEntrypoint} from 'cloudflare:workers';
import {authenticateRequest,hashSecret,randomSecret} from './identity.js';
import {OperationError} from './identity-errors.js';

export async function requireMembership(env,workspaceId,actor,roles) {
  if(!actor) throw new OperationError('unauthorized',401,'Sign in to continue');
  const membership=await env.CP_DB.prepare("SELECT * FROM workspace_members WHERE workspace_id=? AND person_id=? AND status='active'").bind(workspaceId,actor.person.id).first();
  if(!membership || (roles && !roles.includes(membership.role))) throw new OperationError('forbidden',403,'You do not have permission in this workspace');
  return membership;
}
export async function getApp(env,appId) {
  const app=await env.CP_DB.prepare("SELECT * FROM apps WHERE app_id=? AND status!='deleted'").bind(appId).first();
  if(!app) throw new OperationError('not_found',404,'App not found');
  return app;
}
async function requireMaintenanceAuthority(env,app,actor,allowWorkspaceAdministrators) {
  const membership=await requireMembership(env,app.workspace_id,actor);
  if(allowWorkspaceAdministrators && ['owner','admin'].includes(membership.role)) return membership;
  const maintainer=await env.CP_DB.prepare('SELECT 1 FROM app_maintainers WHERE app_id=? AND person_id=?').bind(app.app_id,actor.person.id).first();
  if(!maintainer) throw new OperationError('forbidden',403,'Only app maintainers can change this app');
  return membership;
}
export async function requireMaintainer(env,app,actor) {
  return requireMaintenanceAuthority(env,app,actor,false);
}
export async function requireMaintainerAssignmentAuthority(env,app,actor) {
  return requireMaintenanceAuthority(env,app,actor,true);
}
function maintenanceAdmission(context,appId,policySql,policyParams,personLists,allowWorkspaceAdministrators) {
  const now=Date.now();
  const authoritySql=allowWorkspaceAdministrators
    ? `(member.role IN ('owner','admin') OR EXISTS(
        SELECT 1 FROM app_maintainers maintainer
        WHERE maintainer.app_id=a.app_id AND maintainer.person_id=member.person_id))`
    : `EXISTS(
        SELECT 1 FROM app_maintainers maintainer
        WHERE maintainer.app_id=a.app_id AND maintainer.person_id=member.person_id)`;
  let sql=`EXISTS(SELECT 1 FROM apps a
    JOIN workspace_members member ON member.workspace_id=a.workspace_id
      AND member.person_id=? AND member.status='active'
    JOIN sessions session ON session.session_id=? AND session.person_id=?
      AND session.revoked_at IS NULL AND session.expires_at>?
    WHERE a.app_id=? AND a.status!='deleted'
      AND (session.parent_session_id IS NULL OR EXISTS(
        SELECT 1 FROM sessions parent WHERE parent.session_id=session.parent_session_id
          AND parent.revoked_at IS NULL AND parent.expires_at>?))
      AND ${authoritySql}
      AND (${policySql})`;
  const params=[
    context.actor.person.id,
    context.actor.session.id,
    context.actor.person.id,
    now,
    appId,
    now,
    ...policyParams,
  ];
  for(const personIds of personLists) {
    sql+=` AND NOT EXISTS(SELECT 1 FROM json_each(?) selected
      WHERE NOT EXISTS(SELECT 1 FROM workspace_members target
        WHERE target.workspace_id=a.workspace_id AND target.person_id=selected.value
          AND target.status='active'))`;
    params.push(JSON.stringify(personIds));
  }
  sql+=')';
  return {sql,params};
}
export function maintainerAdmission(context,appId,policySql='1',policyParams=[],personLists=[]) {
  return maintenanceAdmission(context,appId,policySql,policyParams,personLists,false);
}
export function maintainerAssignmentAdmission(context,appId,policySql='1',policyParams=[],personLists=[]) {
  return maintenanceAdmission(context,appId,policySql,policyParams,personLists,true);
}

export async function assertAppAccess(env,app,actor) {
  if(!actor) throw new OperationError('unauthorized',401,'Sign in to open this app');
  const member=await env.CP_DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND person_id=? AND status='active'").bind(app.workspace_id,actor.person.id).first();
  if(!member) {
    const guest=await env.CP_DB.prepare('SELECT 1 FROM app_guests WHERE app_id=? AND person_id=? AND (expires_at IS NULL OR expires_at>?)').bind(app.app_id,actor.person.id,Date.now()).first();
    if(!guest) throw new OperationError('forbidden',403,'This app is not shared with you');
    return {kind:'guest'};
  }
  if(app.audience==='selected') {
    const selected=await env.CP_DB.prepare('SELECT 1 FROM app_people WHERE app_id=? AND person_id=?').bind(app.app_id,actor.person.id).first();
    if(!selected) throw new OperationError('forbidden',403,'This app is not shared with you');
  }
  return {kind:'member',role:member.role};
}
export async function assertActionAccess(env,app,actionName,actor,access,{unpublishedPreview=false}={}) {
  const policy=await env.CP_DB.prepare('SELECT * FROM action_policies WHERE app_id=? AND action_name=?').bind(app.app_id,actionName).first();
  if(!policy) {
    if(unpublishedPreview) return;
    throw new OperationError('action_not_found',404,'This action is not published');
  }
  const denial=await env.CP_DB.prepare('SELECT 1 FROM action_denials WHERE app_id=? AND action_name=? AND person_id=?').bind(app.app_id,actionName,actor.person.id).first();
  if(denial) throw new OperationError('forbidden',403,'You cannot use this action');
  if(access.kind==='guest') {
    const grant=await env.CP_DB.prepare('SELECT 1 FROM app_guest_actions WHERE app_id=? AND person_id=? AND action_name=?').bind(app.app_id,actor.person.id,actionName).first();
    if(!grant) throw new OperationError('forbidden',403,'This action is not shared with you');
    return;
  }
  if(policy.audience==='selected') {
    const grant=await env.CP_DB.prepare('SELECT 1 FROM action_people WHERE app_id=? AND action_name=? AND person_id=?').bind(app.app_id,actionName,actor.person.id).first();
    if(!grant) throw new OperationError('forbidden',403,'This action is not shared with you');
  }
}
async function actorBySession(env,sessionId) {
  const row=await env.CP_DB.prepare(`SELECT s.*,p.email FROM sessions s JOIN people p ON p.person_id=s.person_id
    WHERE s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>?
    AND (s.parent_session_id IS NULL OR EXISTS(SELECT 1 FROM sessions parent WHERE parent.session_id=s.parent_session_id AND parent.revoked_at IS NULL AND parent.expires_at>?))`).bind(sessionId,Date.now(),Date.now()).first();
  if(!row) throw new OperationError('unauthorized',401,'This session has ended');
  return {person:{id:row.person_id,email:row.email},session:{id:row.session_id,kind:row.kind,agentLabel:row.agent_label,expiresAt:row.expires_at}};
}
export async function requireActiveMaintainer(env,app,sessionId) {
  const actor=await actorBySession(env,sessionId);
  await requireMaintainer(env,app,actor);
  return actor;
}
export async function resolveParentInvocation(env,parentInvocationId,sourceAppId) {
  const parent=await env.CP_DB.prepare("SELECT i.*,a.workspace_id FROM invocations i JOIN apps a ON a.app_id=i.app_id WHERE i.invocation_id=? AND i.app_id=? AND i.status='running' AND i.expires_at>?").bind(parentInvocationId,sourceAppId,Date.now()).first();
  if(!parent) throw new OperationError('forbidden',403,'The originating invocation is no longer active');
  const actor=await actorBySession(env,parent.session_id);
  const source=await getApp(env,sourceAppId);
  const sourceAccess=await assertAppAccess(env,source,actor);
  await assertActionAccess(env,source,parent.action_name,actor,sourceAccess);
  return {parent,actor};
}
export async function authorizeCall(env,input) {
  const app=await getApp(env,input.appId);
  const release=await env.CP_DB.prepare('SELECT * FROM releases WHERE release_id=? AND app_id=?').bind(input.releaseId,input.appId).first();
  if(!release) throw new OperationError('not_found',404,'App release not found');
  let actor,parent=null,unpublishedPreview=false,environment='preview',previewMembership=null;
  if(input.kind==='http') {
    const facts=input.request ?? {};
    const host=await env.CP_DB.prepare('SELECT * FROM app_hosts WHERE hostname=? AND app_id=? AND active=1').bind(facts.host,app.app_id).first();
    if(!host || (host.kind!=='live' && host.release_id!==input.releaseId)) throw new OperationError('forbidden',403,'App host does not match its registered release');
    environment=host.kind==='live'?'live':'preview';
    if(input.publicAsset===true) {
      if(input.actionName!==null || !['GET','HEAD'].includes(facts.method) || input.requireMaintenance) {
        throw new OperationError('forbidden',403,'Public authorization is limited to app assets.');
      }
      if(app.status==='ready' && app.public_web===1 && app.active_release_id===input.releaseId && host.kind==='live') {
        return {public:true,workspaceId:app.workspace_id,allowedActions:[]};
      }
    }
    unpublishedPreview=host.kind!=='live';
    const headers=new Headers();
    if(input.credential?.kind==='bearer') headers.set('authorization',`Bearer ${input.credential.token}`);
    if(input.credential?.kind==='cookie') headers.set('cookie',input.credential.cookie);
    if(facts.origin) headers.set('origin',facts.origin);
    actor=await authenticateRequest(new Request(app.url,{method:facts.method ?? 'GET',headers}),{...env,AUTH_ORIGIN:`${new URL(app.url).protocol}//${facts.host}`});
    if(!actor && input.credential?.kind==='cookie') {
      // Host-only app sessions reference a central session, so revocation is immediate.
      const match=/(?:^|;\s*)__Host-atrax_app=([a-f0-9]{64})(?:;|$)/.exec(input.credential.cookie);
      if(match) {
        const row=await env.CP_DB.prepare("SELECT session_id FROM sessions WHERE secret_hash=? AND kind='app' AND app_id=?").bind(await hashSecret(match[1]),app.app_id).first();
        if(row) actor=await actorBySession(env,row.session_id);
        if(actor && !['GET','HEAD'].includes(facts.method) && facts.origin!==`${new URL(app.url).protocol}//${facts.host}`) throw new OperationError('forbidden',403,'Action origin does not match this app');
      }
    }
    if(unpublishedPreview) previewMembership=await requireMaintainer(env,app,actor);
  } else if(input.kind==='child') {
    ({actor,parent}=await resolveParentInvocation(env,input.parentInvocationId,input.sourceAppId));
    environment=parent.environment;
    if(parent.workspace_id!==app.workspace_id) throw new OperationError('forbidden',403,'App calls cannot cross workspaces');
    const sourceRelease=await env.CP_DB.prepare('SELECT manifest_json FROM releases WHERE release_id=?').bind(parent.release_id).first();
    const dependencies=Object.values(JSON.parse(sourceRelease.manifest_json).dependencies ?? {});
    if(!dependencies.some(value=>value.appId===app.app_id)) throw new OperationError('forbidden',403,'This app dependency was not declared');
    if(parent.depth>=8) throw new OperationError('action_chain_too_deep',409,'This action chain is too deep');
  } else throw new OperationError('invalid_input',400,'Invalid authorization request');
  const descriptors=JSON.parse(release.actions_json);
  const authorization={...actor,workspaceId:app.workspace_id,invocationId:null,rootInvocationId:null,depth:parent ? parent.depth+1 : 0,idempotencyKey:input.idempotencyKey ?? null,...(parent ? {sourceAppId:parent.app_id} : {})};
  if(input.requireMaintenance) {
    if(input.kind!=='http'||input.actionName!==null) throw new OperationError('forbidden',403,'Maintenance authorization is limited to app checks');
    if(!previewMembership) await requireMaintainer(env,app,actor);
    return {...authorization,allowedActions:[]};
  }
  const access=previewMembership ? {kind:'member',role:previewMembership.role} : await assertAppAccess(env,app,actor);
  if(input.actionName === null) {
    const allowedActions=[];
    for(const descriptor of descriptors) {
      try {await assertActionAccess(env,app,descriptor.name,actor,access,{unpublishedPreview});allowedActions.push(descriptor.name);} catch(error) {if(![403,404].includes(error.status)) throw error;}
    }
    return {...authorization,allowedActions};
  }
  const descriptor=descriptors.find(action=>action.name===input.actionName);
  if(!descriptor) throw new OperationError('action_not_found',404,'Action not found in this release');
  await assertActionAccess(env,app,descriptor.name,actor,access,{unpublishedPreview});
  if(descriptor.effect==='write' && (typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<1||input.idempotencyKey.length>200)) throw new OperationError('idempotency_key_required',400,'Write actions need an idempotency key');
  const invocationId=crypto.randomUUID();
  const rootInvocationId=parent?.root_invocation_id ?? invocationId;
  await env.CP_DB.prepare(`INSERT INTO invocations(invocation_id,root_invocation_id,parent_invocation_id,session_id,person_id,app_id,release_id,source_app_id,action_name,idempotency_key,depth,status,started_at,expires_at,environment) VALUES(?,?,?,?,?,?,?,?,?,?,?,'running',?,?,?)`).bind(invocationId,rootInvocationId,parent?.invocation_id ?? null,actor.session.id,actor.person.id,app.app_id,release.release_id,parent?.app_id ?? null,descriptor.name,input.idempotencyKey ?? null,authorization.depth,Date.now(),Date.now()+30_000,environment).run();
  return {...authorization,invocationId,rootInvocationId};
}
export async function exchangeAppCode(env,{appId,code,state,callbackUrl}) {
  if(!/^[a-f0-9]{64}$/.test(code ?? '') || !/^[a-f0-9]{64}$/.test(state ?? '')) throw new OperationError('invalid_code',400,'Invalid app sign-in code');
  const app=await getApp(env,appId);
  const callback=new URL(callbackUrl);
  const host=await env.CP_DB.prepare('SELECT * FROM app_hosts WHERE hostname=? AND app_id=? AND active=1').bind(callback.host,appId).first();
  if(!host || callback.pathname!=='/__atrax/auth/callback' || callback.search || callback.hash || callback.username || callback.password || callback.protocol!==new URL(app.url).protocol) throw new OperationError('invalid_code',400,'App callback does not match');
  const codeHash=await hashSecret(code),stateHash=await hashSecret(state),now=Date.now();
  const proof=await env.CP_DB.prepare('SELECT * FROM app_login_codes WHERE code_hash=? AND app_id=? AND state_hash=? AND callback=? AND consumed_at IS NULL AND expires_at>?').bind(codeHash,appId,stateHash,callback.href,now).first();
  if(!proof) throw new OperationError('invalid_code',400,'App sign-in expired or was already used');
  const actor=await actorBySession(env,proof.session_id);
  if(actor.session.kind!=='browser') throw new OperationError('forbidden',403,'App sign-in requires a browser session');
  if(host.kind!=='live') await requireMaintainer(env,app,actor);
  else await assertAppAccess(env,app,actor);
  const token=randomSecret(),sessionId=crypto.randomUUID(),expiresAt=actor.session.expiresAt;
  const admission='EXISTS(SELECT 1 FROM app_login_codes c JOIN sessions parent ON parent.session_id=c.session_id WHERE c.code_hash=? AND c.consumed_at IS NULL AND c.expires_at>? AND parent.revoked_at IS NULL AND parent.expires_at>?)';
  const results=await env.CP_DB.batch([
    env.CP_DB.prepare(`INSERT INTO sessions(session_id,secret_hash,person_id,kind,parent_session_id,app_id,expires_at,created_at) SELECT ?,?,?,'app',?,?,?,? WHERE ${admission}`).bind(sessionId,await hashSecret(token),actor.person.id,actor.session.id,appId,expiresAt,now,codeHash,now,now),
    env.CP_DB.prepare('UPDATE app_login_codes SET consumed_at=? WHERE code_hash=? AND EXISTS(SELECT 1 FROM sessions WHERE session_id=?)').bind(now,codeHash,sessionId),
    env.CP_DB.prepare('SELECT session_id FROM sessions WHERE session_id=?').bind(sessionId),
  ]);
  if(!results[2].results.length) throw new OperationError('invalid_code',400,'App sign-in expired or was already used');
  return {token,expiresAt};
}
export class Door extends WorkerEntrypoint {
  async authorize(input) {
    try {return {ok:true,authorization:await authorizeCall(this.env,input)};}
    catch(error) {
      if(error instanceof OperationError) return {ok:false,error:{code:error.code,status:error.status,message:error.message,details:error.details}};
      throw error;
    }
  }
  async exchangeAppCode(input) {
    try {return {ok:true,session:await exchangeAppCode(this.env,input)};}
    catch(error) {
      if(error instanceof OperationError) return {ok:false,error:{code:error.code,status:error.status,message:error.message}};
      throw error;
    }
  }
  async finishInvocation({invocationId,outcome,errorCode}) {
    if(!['succeeded','failed'].includes(outcome)) throw new OperationError('invalid_input',400,'Invalid invocation outcome');
    await this.env.CP_DB.prepare("UPDATE invocations SET status=?,error_code=?,finished_at=? WHERE invocation_id=? AND status='running'").bind(outcome,errorCode ?? null,Date.now(),invocationId).run();
  }
}
