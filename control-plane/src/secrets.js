import {WorkerEntrypoint} from 'cloudflare:workers';
import {Validator} from '@cfworker/json-schema';
import {secretsOperations} from '../../shared/secrets-operations.js';
import {OperationError} from './identity-errors.js';
import {hashSecret} from './identity.js';
import {requireMembership,resolveParentInvocation} from './access.js';
import {rpcResult} from '../../shared/rpc-result.js';

const validators=new Map(Object.entries(secretsOperations).map(([name,definition])=>[name,new Validator(definition.inputSchema,'7')]));
const encoder=new TextEncoder();
const guard='EXISTS(SELECT 1 FROM secret_operation_receipts WHERE operation_id=?)';
const columns=`s.secret_id,s.workspace_id,s.name,s.description,s.status,s.revision,s.created_by,s.created_at,s.updated_at,
  (SELECT json_group_array(json_object('appId',g.app_id,'bindingName',g.binding_name)) FROM secret_app_grants g WHERE g.secret_id=s.secret_id) AS apps_json`;
const unavailable=()=>new OperationError('secrets_unavailable',503,'Secrets could not complete this request.');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode=value=>Uint8Array.from(atob(value),character=>character.charCodeAt(0));
function view(row) {
  return {id:row.secret_id,workspaceId:row.workspace_id,name:row.name,description:row.description,status:row.status,revision:row.revision,
    apps:JSON.parse(row.apps_json??'[]').sort((a,b)=>a.appId.localeCompare(b.appId)),createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at};
}
async function keys(env) {
  try {
    const raw=decode(env.SECRETS_ENCRYPTION_KEY);
    if(raw.byteLength!==32) throw new Error();
    const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);
    const derive=(purpose,algorithm,usages)=>crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('atrax.workspace-secrets.v1'),info:encoder.encode(purpose)},material,algorithm,false,usages);
    return {encryption:await derive('encryption',{name:'AES-GCM',length:256},['encrypt','decrypt']),mac:await derive('request receipts',{name:'HMAC',hash:'SHA-256',length:256},['sign'])};
  } catch {throw unavailable();}
}
async function encrypt(key,workspaceId,secretId,value) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify([workspaceId,secretId]))},key,encoder.encode(value));
  return {ciphertext:encode(ciphertext),iv:encode(iv)};
}
async function metadata(env,workspaceId,secretId) {
  const row=await env.CP_DB.prepare(`SELECT ${columns} FROM workspace_secrets s WHERE s.workspace_id=? AND s.secret_id=?`).bind(workspaceId,secretId).first();
  if(!row) throw new OperationError('not_found',404,'Credential not found.');
  return view(row);
}
async function receipt(context) {
  return context.env.CP_DB.prepare('SELECT input_mac,result_json FROM secret_operation_receipts WHERE person_id=? AND operation_name=? AND key_hash=?').bind(context.actor.person.id,context.operation,context.keyHash).first();
}
function replay(context,row) {
  if(row.input_mac!==context.inputMac) throw new OperationError('idempotency_conflict',409,'This key was already used with different input.');
  return {result:JSON.parse(row.result_json),replayed:true};
}
function administrator(context) {
  const now=Date.now();
  return {sql:`EXISTS(SELECT 1 FROM workspace_members m JOIN sessions s ON s.person_id=m.person_id
    WHERE m.workspace_id=? AND m.person_id=? AND m.status='active' AND m.role IN ('owner','admin')
    AND s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>?
    AND (s.parent_session_id IS NULL OR EXISTS(SELECT 1 FROM sessions p WHERE p.session_id=s.parent_session_id AND p.revoked_at IS NULL AND p.expires_at>?)))`,
    params:[context.workspaceId,context.actor.person.id,context.actor.session.id,now,now]};
}
async function mutate(name,input,context,key) {
  const {env,actor,workspaceId}=context,db=env.CP_DB,now=Date.now();
  const creating=name==='secrets.create';
  const current=creating?null:await metadata(env,workspaceId,input.secretId);
  if(current?.status==='revoked') throw new OperationError('secret_revoked',409,'This credential is revoked. Create a new credential to use it again.');
  if(current&&current.revision!==input.baseRevision) throw new OperationError('revision_conflict',409,'The credential changed. Read its current metadata before changing it.',{currentRevision:current.revision});
  const secret=creating?{id:crypto.randomUUID(),workspaceId,name:input.name.trim(),description:input.description??'',status:'active',revision:1,apps:[],createdBy:actor.person.id,createdAt:now,updatedAt:now}:{...current,revision:current.revision+1,updatedAt:now};
  if(name==='secrets.update') Object.assign(secret,{name:input.name.trim(),description:input.description});
  if(name==='secrets.setApps') {
    secret.apps=[...input.apps].sort((a,b)=>a.appId.localeCompare(b.appId));
    if(new Set(secret.apps.map(app=>app.appId)).size!==secret.apps.length) throw new OperationError('invalid_input',400,'Grant each app one binding for this credential.');
  }
  if(name==='secrets.revoke') Object.assign(secret,{status:'revoked',apps:[]});
  const encrypted=(creating||name==='secrets.rotate')?await encrypt(key,workspaceId,secret.id,input.value):null;
  const admission=administrator(context);
  if(!creating) {admission.sql+=" AND EXISTS(SELECT 1 FROM workspace_secrets WHERE secret_id=? AND workspace_id=? AND revision=? AND status='active')";admission.params.push(secret.id,workspaceId,input.baseRevision);}
  if(name==='secrets.setApps') {
    admission.sql+=` AND NOT EXISTS(SELECT 1 FROM json_each(?) item WHERE NOT EXISTS(SELECT 1 FROM apps a WHERE a.app_id=json_extract(item.value,'$.appId') AND a.workspace_id=? AND a.status!='deleted')
      OR EXISTS(SELECT 1 FROM secret_app_grants g WHERE g.app_id=json_extract(item.value,'$.appId') AND g.binding_name=json_extract(item.value,'$.bindingName') AND g.secret_id!=?))`;
    admission.params.push(JSON.stringify(secret.apps),workspaceId,secret.id);
  }
  const operationId=crypto.randomUUID(),result={secret};
  const writes=[];
  if(creating) writes.push(db.prepare(`INSERT INTO workspace_secrets(secret_id,workspace_id,name,description,status,revision,ciphertext,iv,created_by,created_at,updated_at) SELECT ?,?,?,?,'active',1,?,?,?,?,? WHERE ${guard}`).bind(secret.id,workspaceId,secret.name,secret.description,encrypted.ciphertext,encrypted.iv,actor.person.id,now,now,operationId));
  else {
    const assignments=['name=?','description=?','status=?','revision=?','updated_at=?'],params=[secret.name,secret.description,secret.status,secret.revision,now];
    if(encrypted||name==='secrets.revoke') {assignments.push('ciphertext=?','iv=?');params.push(encrypted?.ciphertext??null,encrypted?.iv??null);}
    writes.push(db.prepare(`UPDATE workspace_secrets SET ${assignments.join(',')} WHERE secret_id=? AND ${guard}`).bind(...params,secret.id,operationId));
  }
  if(['secrets.setApps','secrets.revoke'].includes(name)) {
    writes.push(db.prepare(`DELETE FROM secret_app_grants WHERE secret_id=? AND ${guard}`).bind(secret.id,operationId));
    if(secret.apps.length) writes.push(db.prepare(`INSERT INTO secret_app_grants(secret_id,app_id,binding_name) SELECT ?,json_extract(value,'$.appId'),json_extract(value,'$.bindingName') FROM json_each(?) WHERE ${guard}`).bind(secret.id,JSON.stringify(secret.apps),operationId));
  }
  writes.push(db.prepare(`INSERT INTO activity(activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,created_at) SELECT ?,?,?,?,?,?,'succeeded',? WHERE ${guard}`).bind(operationId,workspaceId,actor.person.id,actor.session.id,name,secret.id,now,operationId));
  let batch;
  try {
    batch=await db.batch([
      db.prepare(`INSERT OR IGNORE INTO secret_operation_receipts(operation_id,workspace_id,person_id,operation_name,key_hash,input_mac,result_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${admission.sql}`)
        .bind(operationId,workspaceId,actor.person.id,name,context.keyHash,context.inputMac,JSON.stringify(result),now,...admission.params),...writes,
    ]);
  } catch {throw unavailable();}
  if(batch[0].meta.changes!==1) {
    const previous=await receipt(context);
    if(previous) return replay(context,previous);
    await requireMembership(env,workspaceId,actor,['owner','admin']);
    if(!creating) {
      const latest=await metadata(env,workspaceId,secret.id);
      if(latest.revision!==input.baseRevision) throw new OperationError('revision_conflict',409,'The credential changed. Read its current metadata before changing it.',{currentRevision:latest.revision});
    }
    throw new OperationError('secret_changed',409,'Credential access or app bindings changed. Check the app workspace and existing binding names, then refresh.');
  }
  return {result};
}
export async function handleSecretsOperation(name,input,context) {
  if(!Object.hasOwn(secretsOperations,name)) return null;
  try {
    if(!validators.get(name).validate(input).valid) throw new OperationError('invalid_input',400,'Invalid credential input. Inspect the operation schema.');
    await requireMembership(context.env,input.workspaceId,context.actor,['owner','admin']);
    if(name==='secrets.list') {
      const rows=await context.env.CP_DB.prepare(`SELECT ${columns} FROM workspace_secrets s WHERE workspace_id=? ORDER BY updated_at DESC,secret_id`).bind(input.workspaceId).all();
      return {result:{secrets:rows.results.map(view)}};
    }
    const idempotencyKey=context.idempotencyKey;
    if(typeof idempotencyKey!=='string'||!idempotencyKey.trim()||idempotencyKey.length>200) throw new OperationError('idempotency_key_required',400,'Credential writes need an Idempotency-Key of at most 200 characters.');
    const key=await keys(context.env);
    const operationContext={...context,workspaceId:input.workspaceId,operation:name,keyHash:await hashSecret(idempotencyKey),inputMac:encode(await crypto.subtle.sign('HMAC',key.mac,encoder.encode(JSON.stringify(canonical(input)))))};
    const previous=await receipt(operationContext);
    if(previous) return replay(operationContext,previous);
    try {return await mutate(name,input,operationContext,key.encryption);}
    catch(error) {
      // A concurrent copy can commit after the initial receipt read but before
      // the revision read. The committed request still owns this retry key.
      if(['revision_conflict','secret_revoked'].includes(error.code)) {
        const committed=await receipt(operationContext);
        if(committed) return replay(operationContext,committed);
      }
      throw error;
    }
  } catch(error) {
    if(error instanceof OperationError) throw error;
    throw unavailable();
  }
}
export class Secrets extends WorkerEntrypoint {
  async get({parentInvocationId,sourceAppId,bindingName}) {
    return rpcResult(async()=>{
      try {
        if(typeof bindingName!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(bindingName)) throw new OperationError('invalid_input',400,'Invalid credential binding name.');
        const {parent}=await resolveParentInvocation(this.env,parentInvocationId,sourceAppId);
        if(parent.environment!=='live') throw new OperationError('forbidden',403,'Live credentials are unavailable in previews.');
        const row=await this.env.CP_DB.prepare(`SELECT s.secret_id,s.workspace_id,s.ciphertext,s.iv FROM workspace_secrets s
          JOIN secret_app_grants g ON g.secret_id=s.secret_id JOIN apps a ON a.app_id=g.app_id
          WHERE g.app_id=? AND g.binding_name=? AND s.workspace_id=? AND s.status='active' AND a.status='ready' AND a.active_release_id=?`)
          .bind(sourceAppId,bindingName,parent.workspace_id,parent.release_id).first();
        if(!row) throw new OperationError('secret_not_available',403,'This credential binding is unavailable to the app.');
        const key=await keys(this.env);
        const value=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(row.iv),additionalData:encoder.encode(JSON.stringify([row.workspace_id,row.secret_id]))},key.encryption,decode(row.ciphertext));
        return new TextDecoder().decode(value);
      } catch(error) {
        if(error instanceof OperationError) throw error;
        throw unavailable();
      }
    });
  }
}
