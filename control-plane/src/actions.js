import {getApp,assertAppAccess,requireMembership} from './access.js';
import {OperationError} from './identity-errors.js';

export async function handleActionOperation(name,input,{env,actor,request,idempotencyKey}) {
  if(name==='activity.list') {
    const member=await requireMembership(env,input.workspaceId,actor);
    const admin=['owner','admin'].includes(member.role)?1:0;
    // Administrators audit the workspace; members inspect their own activity.
    const events=await env.CP_DB.prepare(`SELECT a.activity_id id,a.operation,a.target_id targetId,a.outcome,a.created_at createdAt,p.email,s.agent_label agentLabel FROM activity a LEFT JOIN people p ON p.person_id=a.person_id LEFT JOIN sessions s ON s.session_id=a.session_id WHERE a.workspace_id=? AND (?=1 OR a.person_id=?) ORDER BY a.created_at DESC LIMIT 100`).bind(input.workspaceId,admin,actor.person.id).all();
    const invocations=await env.CP_DB.prepare(`SELECT i.invocation_id id,i.app_id appId,i.action_name actionName,i.status outcome,i.error_code errorCode,i.started_at createdAt,p.email,s.agent_label agentLabel
      FROM invocations i JOIN apps a ON a.app_id=i.app_id JOIN people p ON p.person_id=i.person_id JOIN sessions s ON s.session_id=i.session_id
      WHERE a.workspace_id=? AND (?=1 OR (i.person_id=? AND a.status!='deleted'
        AND (a.audience!='selected' OR EXISTS(SELECT 1 FROM app_people ap WHERE ap.app_id=a.app_id AND ap.person_id=?))
        AND EXISTS(SELECT 1 FROM action_policies policy WHERE policy.app_id=a.app_id AND policy.action_name=i.action_name
          AND (policy.audience='workspace' OR EXISTS(SELECT 1 FROM action_people allowed WHERE allowed.app_id=a.app_id AND allowed.action_name=i.action_name AND allowed.person_id=?)))
        AND NOT EXISTS(SELECT 1 FROM action_denials denied WHERE denied.app_id=a.app_id AND denied.action_name=i.action_name AND denied.person_id=?)))
      ORDER BY i.started_at DESC LIMIT 100`).bind(input.workspaceId,admin,actor.person.id,actor.person.id,actor.person.id,actor.person.id).all();
    return {result:{events:events.results,invocations:invocations.results}};
  }
  if(!['actions.list','actions.call'].includes(name)) return null;
  const app=await getApp(env,input.appId);
  await assertAppAccess(env,app,actor);
  if(!app.active_release_id||app.status!=='ready') throw new OperationError('app_not_ready',409,'Deploy this app before calling its actions');
  const headers=new Headers({'Accept':'application/json'});
  for(const key of ['authorization','cookie','origin']) if(request.headers.has(key)) headers.set(key,request.headers.get(key));
  if(idempotencyKey) headers.set('Idempotency-Key',idempotencyKey);
  const calling=name==='actions.call';
  if(calling) headers.set('Content-Type','application/json');
  const path=calling ? `/__atrax/actions/${encodeURIComponent(input.actionName)}` : '/__atrax/actions';
  let response;
  try {response=await fetch(new URL(path,app.url),{method:calling?'POST':'GET',headers,...(calling?{body:JSON.stringify(input.input)}:{}),redirect:'manual',signal:AbortSignal.timeout(30_000)});}
  catch {throw new OperationError('app_unavailable',502,'The app did not return a complete response. Retry writes with the same key.');}
  let value;
  try {value=await response.json();} catch {throw new OperationError('app_unavailable',502,'The app returned an invalid response. Retry writes with the same key.');}
  if(!response.ok||value.status==='failed') {
    const failure=value.error;
    throw new OperationError(failure?.code ?? 'app_unavailable',response.status>=400?response.status:502,failure?.message ?? 'The app could not complete this operation',failure?.details);
  }
  return {result:calling?{result:value.result,invocationId:value.operationId}:value};
}
