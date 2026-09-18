import {canonicalJson} from '../../shared/app-contract.js';
import {
  getApp,
  maintainerAdmission,
  maintainerAssignmentAdmission,
  requireMaintainer,
  requireMaintainerAssignmentAuthority,
} from './access.js';
import {OperationError,inputString} from './identity-errors.js';
import {hashSecret} from './identity.js';

const receiptGuard='EXISTS(SELECT 1 FROM operation_receipts WHERE operation_id=?)';

function sortedIds(values) {
  return [...values].sort((left,right)=>left.localeCompare(right));
}

function parseIds(value) {
  return sortedIds(JSON.parse(value ?? '[]'));
}

function appAccessView(row,overrides={}) {
  return {
    appId:row.app_id,
    audience:overrides.audience ?? row.audience,
    personIds:overrides.personIds ?? parseIds(row.people_json),
    maintainerPersonIds:overrides.maintainerPersonIds ?? parseIds(row.maintainers_json),
    revision:overrides.revision ?? row.access_revision,
  };
}

function actionAccessView(row,overrides={}) {
  return {
    appId:row.app_id,
    actionName:row.action_name,
    audience:overrides.audience ?? row.audience,
    personIds:overrides.personIds ?? parseIds(row.people_json),
    deniedPersonIds:overrides.deniedPersonIds ?? parseIds(row.denials_json),
    revision:overrides.revision ?? row.revision,
  };
}

async function managedApp(context,appId) {
  const app=await getApp(context.env,appId);
  await requireMaintainer(context.env,app,context.actor);
  return app;
}

async function appAccessRow(env,appId) {
  return env.CP_DB.prepare(`SELECT a.*,
    COALESCE((SELECT json_group_array(person_id) FROM
      (SELECT person_id FROM app_people WHERE app_id=a.app_id ORDER BY person_id)),'[]') AS people_json,
    COALESCE((SELECT json_group_array(person_id) FROM
      (SELECT person_id FROM app_maintainers WHERE app_id=a.app_id ORDER BY person_id)),'[]') AS maintainers_json
    FROM apps a WHERE a.app_id=? AND a.status!='deleted'`).bind(appId).first();
}

async function actionAccessRow(env,appId,actionName) {
  return env.CP_DB.prepare(`SELECT p.*,
    COALESCE((SELECT json_group_array(person_id) FROM
      (SELECT person_id FROM action_people WHERE app_id=p.app_id AND action_name=p.action_name ORDER BY person_id)),'[]') AS people_json,
    COALESCE((SELECT json_group_array(person_id) FROM
      (SELECT person_id FROM action_denials WHERE app_id=p.app_id AND action_name=p.action_name ORDER BY person_id)),'[]') AS denials_json
    FROM action_policies p WHERE p.app_id=? AND p.action_name=?`).bind(appId,actionName).first();
}

async function requireActionAccessRow(context,appId,actionName) {
  await managedApp(context,appId);
  const row=await actionAccessRow(context.env,appId,actionName);
  if(!row) throw new OperationError('action_not_found',404,'This action is not published by the app.');
  return row;
}

async function requireActiveMembers(env,workspaceId,personIds) {
  const row=await env.CP_DB.prepare(`SELECT COUNT(*) AS count FROM workspace_members
    WHERE workspace_id=? AND status='active' AND person_id IN (SELECT value FROM json_each(?))`)
    .bind(workspaceId,JSON.stringify(personIds)).first();
  if(Number(row.count)!==personIds.length) {
    throw new OperationError('invalid_member',400,'Select only active members of this workspace.');
  }
}

function selectedAudience(audience,personIds) {
  if(audience==='workspace' && personIds.length) {
    throw new OperationError('invalid_input',400,'A workspace audience cannot include selected people.');
  }
}


async function findReceipt(context,name,targetId,idempotencyKey) {
  return context.env.CP_DB.prepare(`SELECT input_hash,result_json FROM operation_receipts
    WHERE person_id=? AND operation=? AND target_id=? AND idempotency_key=?`)
    .bind(context.actor.person.id,name,targetId,idempotencyKey).first();
}

function receiptResult(receipt,inputHash) {
  if(receipt.input_hash!==inputHash) {
    throw new OperationError('idempotency_conflict',409,'This idempotency key was already used with different sharing details.');
  }
  return {result:JSON.parse(receipt.result_json)};
}

function revisionConflict(currentRevision) {
  return new OperationError(
    'policy_revision_conflict',
    409,
    'This sharing policy changed after you opened it. Read the current policy and try again.',
    {currentRevision},
  );
}

async function replayExisting(context,name,targetId,input) {
  const idempotencyKey=inputString(context.idempotencyKey,'Idempotency-Key',200);
  const inputHash=await hashSecret(canonicalJson(input));
  const previous=await findReceipt(context,name,targetId,idempotencyKey);
  return previous ? receiptResult(previous,inputHash) : null;
}

async function commitPolicy(context,{name,appId,targetId,input,result,admission,writes,currentRevision}) {
  const idempotencyKey=inputString(context.idempotencyKey,'Idempotency-Key',200);
  const inputHash=await hashSecret(canonicalJson(input));
  const previous=await findReceipt(context,name,targetId,idempotencyKey);
  if(previous) return receiptResult(previous,inputHash);
  const operationId=crypto.randomUUID();
  const now=Date.now();
  let batch;
  try {
    batch=await context.env.CP_DB.batch([
      context.env.CP_DB.prepare(`INSERT INTO operation_receipts
        (operation_id,person_id,operation,target_id,idempotency_key,input_hash,result_json,created_at)
        SELECT ?,?,?,?,?,?,?,? WHERE ${admission.sql}`)
        .bind(operationId,context.actor.person.id,name,targetId,idempotencyKey,inputHash,JSON.stringify(result),now,...admission.params),
      ...writes(operationId,now),
      context.env.CP_DB.prepare(`INSERT INTO activity
        (activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,details_json,created_at)
        SELECT ?,a.workspace_id,?,?,?,?,'succeeded',?,? FROM apps a
        WHERE a.app_id=? AND ${receiptGuard}`)
        .bind(crypto.randomUUID(),context.actor.person.id,context.actor.session.id,name,targetId,JSON.stringify(result),now,appId,operationId),
    ]);
  } catch(error) {
    const concurrent=await findReceipt(context,name,targetId,idempotencyKey);
    if(concurrent) return receiptResult(concurrent,inputHash);
    throw error;
  }
  if(batch[0].meta.changes!==1) {
    const revision=await currentRevision();
    if(revision!==input.expectedRevision) throw revisionConflict(revision);
    throw new OperationError('sharing_changed',409,'Your session, role, or workspace membership changed. Refresh and try again.');
  }
  return {result};
}

async function getAppAccess(input,context) {
  const app=await getApp(context.env,input.appId);
  await requireMaintainerAssignmentAuthority(context.env,app,context.actor);
  return {result:{access:appAccessView(await appAccessRow(context.env,input.appId))}};
}

async function setAppAccess(input,context) {
  const app=await managedApp(context,input.appId);
  const personIds=sortedIds(input.personIds);
  const normalizedInput={...input,personIds};
  const replay=await replayExisting(context,'apps.access.set',input.appId,normalizedInput);
  if(replay) return replay;
  const current=await appAccessRow(context.env,input.appId);
  if(current.access_revision!==input.expectedRevision) throw revisionConflict(current.access_revision);
  selectedAudience(input.audience,personIds);
  await requireActiveMembers(context.env,app.workspace_id,personIds);
  const access=appAccessView(current,{
    audience:input.audience,
    personIds,
    revision:current.access_revision+1,
  });
  const result={access};
  const admission=maintainerAdmission(
    context,
    input.appId,
    'a.access_revision=?',
    [input.expectedRevision],
    [personIds],
  );
  return commitPolicy(context,{
    name:'apps.access.set',
    appId:input.appId,
    targetId:input.appId,
    input:normalizedInput,
    result,
    admission,
    currentRevision:async()=>Number((await appAccessRow(context.env,input.appId))?.access_revision ?? 0),
    writes:(operationId,now)=>[
      context.env.CP_DB.prepare(`UPDATE apps SET audience=?,access_revision=access_revision+1,updated_at=?
        WHERE app_id=? AND ${receiptGuard}`).bind(input.audience,now,input.appId,operationId),
      context.env.CP_DB.prepare(`DELETE FROM app_people WHERE app_id=? AND ${receiptGuard}`)
        .bind(input.appId,operationId),
      context.env.CP_DB.prepare(`INSERT INTO app_people(app_id,person_id)
        SELECT ?,value FROM json_each(?) WHERE ${receiptGuard}`)
        .bind(input.appId,JSON.stringify(personIds),operationId),
    ],
  });
}

async function setMaintainers(input,context) {
  const app=await getApp(context.env,input.appId);
  await requireMaintainerAssignmentAuthority(context.env,app,context.actor);
  const personIds=sortedIds(input.personIds);
  const normalizedInput={...input,personIds};
  const replay=await replayExisting(context,'apps.maintainers.set',input.appId,normalizedInput);
  if(replay) return replay;
  const current=await appAccessRow(context.env,input.appId);
  if(current.access_revision!==input.expectedRevision) throw revisionConflict(current.access_revision);
  if(!personIds.length) throw new OperationError('invalid_input',400,'An app needs at least one maintainer.');
  await requireActiveMembers(context.env,app.workspace_id,personIds);
  const access=appAccessView(current,{
    maintainerPersonIds:personIds,
    revision:current.access_revision+1,
  });
  const result={access};
  const admission=maintainerAssignmentAdmission(
    context,
    input.appId,
    'a.access_revision=?',
    [input.expectedRevision],
    [personIds],
  );
  return commitPolicy(context,{
    name:'apps.maintainers.set',
    appId:input.appId,
    targetId:input.appId,
    input:normalizedInput,
    result,
    admission,
    currentRevision:async()=>Number((await appAccessRow(context.env,input.appId))?.access_revision ?? 0),
    writes:(operationId,now)=>[
      context.env.CP_DB.prepare(`UPDATE apps SET access_revision=access_revision+1,updated_at=?
        WHERE app_id=? AND ${receiptGuard}`).bind(now,input.appId,operationId),
      context.env.CP_DB.prepare(`DELETE FROM app_maintainers WHERE app_id=? AND ${receiptGuard}`)
        .bind(input.appId,operationId),
      context.env.CP_DB.prepare(`INSERT INTO app_maintainers(app_id,person_id)
        SELECT ?,value FROM json_each(?) WHERE ${receiptGuard}`)
        .bind(input.appId,JSON.stringify(personIds),operationId),
    ],
  });
}

async function getActionAccess(input,context) {
  const row=await requireActionAccessRow(context,input.appId,input.actionName);
  return {result:{access:actionAccessView(row)}};
}

async function setActionAccess(input,context) {
  const app=await managedApp(context,input.appId);
  const current=await actionAccessRow(context.env,input.appId,input.actionName);
  if(!current) throw new OperationError('action_not_found',404,'This action is not published by the app.');
  const personIds=sortedIds(input.personIds);
  const deniedPersonIds=sortedIds(input.deniedPersonIds);
  const targetId=`${input.appId}/${input.actionName}`;
  const normalizedInput={...input,personIds,deniedPersonIds};
  const replay=await replayExisting(context,'actions.access.set',targetId,normalizedInput);
  if(replay) return replay;
  if(current.revision!==input.expectedRevision) throw revisionConflict(current.revision);
  selectedAudience(input.audience,personIds);
  if(personIds.some(personId=>deniedPersonIds.includes(personId))) {
    throw new OperationError('invalid_input',400,'A person cannot be both selected and denied for the same action.');
  }
  await requireActiveMembers(context.env,app.workspace_id,personIds);
  await requireActiveMembers(context.env,app.workspace_id,deniedPersonIds);
  const access=actionAccessView(current,{
    audience:input.audience,
    personIds,
    deniedPersonIds,
    revision:current.revision+1,
  });
  const result={access};
  const admission=maintainerAdmission(
    context,
    input.appId,
    `EXISTS(SELECT 1 FROM action_policies policy
      WHERE policy.app_id=a.app_id AND policy.action_name=? AND policy.revision=?)`,
    [input.actionName,input.expectedRevision],
    [personIds,deniedPersonIds],
  );
  return commitPolicy(context,{
    name:'actions.access.set',
    appId:input.appId,
    targetId,
    input:normalizedInput,
    result,
    admission,
    currentRevision:async()=>Number((await actionAccessRow(context.env,input.appId,input.actionName))?.revision ?? 0),
    writes:(operationId)=>[
      context.env.CP_DB.prepare(`UPDATE action_policies SET audience=?,revision=revision+1
        WHERE app_id=? AND action_name=? AND ${receiptGuard}`)
        .bind(input.audience,input.appId,input.actionName,operationId),
      context.env.CP_DB.prepare(`DELETE FROM action_people
        WHERE app_id=? AND action_name=? AND ${receiptGuard}`)
        .bind(input.appId,input.actionName,operationId),
      context.env.CP_DB.prepare(`INSERT INTO action_people(app_id,action_name,person_id)
        SELECT ?,?,value FROM json_each(?) WHERE ${receiptGuard}`)
        .bind(input.appId,input.actionName,JSON.stringify(personIds),operationId),
      context.env.CP_DB.prepare(`DELETE FROM action_denials
        WHERE app_id=? AND action_name=? AND ${receiptGuard}`)
        .bind(input.appId,input.actionName,operationId),
      context.env.CP_DB.prepare(`INSERT INTO action_denials(app_id,action_name,person_id)
        SELECT ?,?,value FROM json_each(?) WHERE ${receiptGuard}`)
        .bind(input.appId,input.actionName,JSON.stringify(deniedPersonIds),operationId),
    ],
  });
}

export async function handleSharingOperation(name,input,context) {
  if(name==='apps.access.get') return getAppAccess(input,context);
  if(name==='apps.access.set') return setAppAccess(input,context);
  if(name==='apps.maintainers.set') return setMaintainers(input,context);
  if(name==='actions.access.get') return getActionAccess(input,context);
  if(name==='actions.access.set') return setActionAccess(input,context);
  return null;
}
