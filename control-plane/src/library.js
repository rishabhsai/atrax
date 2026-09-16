import {WorkerEntrypoint} from 'cloudflare:workers';
import {Validator} from '@cfworker/json-schema';
import {libraryOperations} from '../../shared/library-operations.js';
import {libraryFileOperations} from '../../shared/library-file-operations.js';
import {handleLibraryFileOperation} from './library-files.js';
import {OperationError,inputString} from './identity-errors.js';
import {hashSecret} from './identity.js';
import {requireMembership,resolveParentInvocation} from './access.js';

const definitions={...libraryOperations,...libraryFileOperations};
const validators=new Map(Object.entries(definitions).map(([name,definition])=>[name,new Validator(definition.inputSchema,'7')]));
const guard='EXISTS(SELECT 1 FROM library_operation_receipts WHERE operation_id=?)';

// Every revision has its own provenance graph. Each node uses its item's current
// audience, including historical revisions and sources whose content was corrected.
const accessSql=`WITH RECURSIVE
  viewer(workspace_id,person_id,session_id,now) AS (VALUES(?,?,?,?)),
  ancestry(root_id,revision_id) AS (
    SELECT r.revision_id,r.revision_id FROM library_revisions r JOIN library_items i ON i.item_id=r.item_id
      WHERE i.workspace_id=(SELECT workspace_id FROM viewer)
    UNION
    SELECT a.root_id,s.source_revision_id FROM ancestry a JOIN library_sources s ON s.revision_id=a.revision_id
  ),
  live_viewer AS (
    SELECT v.* FROM viewer v
    JOIN workspace_members m ON m.workspace_id=v.workspace_id AND m.person_id=v.person_id AND m.status='active'
    JOIN sessions s ON s.session_id=v.session_id AND s.person_id=v.person_id AND s.revoked_at IS NULL AND s.expires_at>v.now
    WHERE s.parent_session_id IS NULL OR EXISTS(SELECT 1 FROM sessions parent WHERE parent.session_id=s.parent_session_id AND parent.revoked_at IS NULL AND parent.expires_at>v.now)
  ),
  accessible AS (
    SELECT r.revision_id,r.item_id FROM library_revisions r JOIN library_items i ON i.item_id=r.item_id JOIN live_viewer v ON v.workspace_id=i.workspace_id
    WHERE NOT EXISTS(
      SELECT 1 FROM ancestry a JOIN library_revisions dependency ON dependency.revision_id=a.revision_id
      JOIN library_items source ON source.item_id=dependency.item_id
      WHERE a.root_id=r.revision_id AND (source.workspace_id!=v.workspace_id OR
        (source.audience='selected' AND NOT EXISTS(SELECT 1 FROM library_people p WHERE p.item_id=source.item_id AND p.person_id=v.person_id)))
    )
  )`;
const rowColumns=`i.*,r.revision_id,r.revision_number,r.title,r.body_text,r.reason,r.author_person_id,r.author_session_id,
  r.created_at AS revision_created_at,r.indexing_status,p.email,s.kind AS author_kind,s.agent_label,
  (SELECT json_group_array(person_id) FROM library_people WHERE item_id=i.item_id) AS people_json,
  (SELECT json_group_array(json_object('itemId',source.item_id,'revisionId',source.revision_id))
    FROM library_sources refs JOIN library_revisions source ON source.revision_id=refs.source_revision_id WHERE refs.revision_id=r.revision_id) AS sources_json,
  f.object_key AS file_object_key,f.filename AS file_filename,f.content_type AS file_content_type,f.byte_size AS file_byte_size,f.sha256 AS file_sha256,f.uploaded_at AS file_uploaded_at`;
const rowJoins=`FROM library_items i JOIN library_revisions r ON r.item_id=i.item_id
  JOIN accessible allowed ON allowed.revision_id=r.revision_id
  JOIN people p ON p.person_id=r.author_person_id JOIN sessions s ON s.session_id=r.author_session_id
  LEFT JOIN library_file_versions f ON f.revision_id=r.revision_id`;
const accessParams=context=>[context.workspaceId,context.actor.person.id,context.actor.session.id,Date.now()];

function itemView(row) {
  return {id:row.item_id,workspaceId:row.workspace_id,kind:row.kind,status:row.status,audience:row.audience,
    personIds:JSON.parse(row.people_json ?? '[]'),currentRevisionId:row.current_revision_id,title:row.title,
    createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at,indexingStatus:row.indexing_status};
}
function revisionView(row) {
  return {id:row.revision_id,number:row.revision_number,title:row.title,text:row.body_text,reason:row.reason,
    author:{personId:row.author_person_id,email:row.email,sessionId:row.author_session_id,kind:row.author_kind,agentLabel:row.agent_label ?? null},
    createdAt:row.revision_created_at,sourceRevisions:JSON.parse(row.sources_json ?? '[]'),indexingStatus:row.indexing_status,
    ...(row.filename ?? row.file_filename ? {file:{filename:row.filename ?? row.file_filename,contentType:row.content_type ?? row.file_content_type,byteSize:row.byte_size ?? row.file_byte_size,sha256:row.sha256 ?? row.file_sha256,uploadedAt:row.uploaded_at ?? row.file_uploaded_at}} : {})};
}
function itemResult(row) {return {item:itemView(row),revision:revisionView(row)};}
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
async function readable(context,itemId,revisionId) {
  const row=await context.env.CP_DB.prepare(`${accessSql} SELECT ${rowColumns} ${rowJoins}
    WHERE i.item_id=? AND i.workspace_id=? AND r.revision_id=${revisionId ? '?' : 'i.current_revision_id'}`)
    .bind(...accessParams(context),itemId,context.workspaceId,...(revisionId ? [revisionId] : [])).first();
  if(!row) throw new OperationError('not_found',404,'This Library item or revision is not available to you.');
  return row;
}
function canManage(context,item) {return item.created_by===context.actor.person.id || ['owner','admin'].includes(context.membership.role);}
function requireManage(context,item) {
  if(!canManage(context,item)) throw new OperationError('forbidden',403,'Only the contributor or a workspace admin can change access or archive this item.');
}
async function readOperation(name,input,context) {
  const db=context.env.CP_DB;
  if(name==='library.get') return {result:itemResult(await readable(context,input.itemId,input.revisionId))};
  if(name==='library.history') {
    const item=await readable(context,input.itemId);
    const rows=await db.prepare(`${accessSql} SELECT ${rowColumns} ${rowJoins} WHERE i.item_id=? ORDER BY r.revision_number DESC`)
      .bind(...accessParams(context),input.itemId).all();
    return {result:{item:itemView(item),revisions:rows.results.map(revisionView)}};
  }
  const limit=input.limit ?? 50;
  const search=name==='library.search';
  const query=search ? inputString(input.query,'query',500).split(/\s+/).map(word=>`"${word.replaceAll('"','""')}"`).join(' AND ') : null;
  const rows=await db.prepare(`${accessSql} SELECT ${rowColumns}${search ? ",snippet(library_search,2,'','','…',24) AS snippet" : ''}
    ${rowJoins} ${search ? 'JOIN library_search ON library_search.item_id=i.item_id' : ''}
    WHERE i.status='active' AND r.revision_id=i.current_revision_id ${search ? 'AND library_search MATCH ?' : ''}
    ORDER BY ${search ? 'bm25(library_search),' : ''}i.updated_at DESC,i.item_id LIMIT ?`)
    .bind(...accessParams(context),...(search ? [query] : []),limit).all();
  return {result:{items:rows.results.map(row=>({...itemView(row),revisionId:row.revision_id,sourceRevisions:JSON.parse(row.sources_json),...(row.file_filename ? {file:revisionView(row).file} : {}),...(search ? {snippet:row.snippet} : {})}))}};
}
async function findReceipt(context) {
  return context.env.CP_DB.prepare('SELECT * FROM library_operation_receipts WHERE person_id=? AND operation_name=? AND key_hash=?')
    .bind(context.actor.person.id,context.operation,context.keyHash).first();
}
async function replay(context,receipt) {
  if(receipt.input_hash!==context.inputHash) throw new OperationError('idempotency_conflict',409,'This idempotency key was already used with different input.');
  const current=await readable(context,receipt.item_id);
  if(receipt.revision_id) await readable(context,receipt.item_id,receipt.revision_id);
  if(['library.setAccess','library.archive'].includes(context.operation)) requireManage(context,current);
  return {result:JSON.parse(receipt.result_json),replayed:true};
}
function conflict(currentRevisionId) {
  return new OperationError('revision_conflict',409,'This entry was corrected after you opened it. Read the current revision before correcting it.',{currentRevisionId});
}
async function commit(context,result,admission,writes,baseRevisionId) {
  const {env,actor}=context;
  const operationId=crypto.randomUUID();
  const itemId=result.item.id;
  const now=Date.now();
  let changes;
  try {
    const batch=await env.CP_DB.batch([
      env.CP_DB.prepare(`${accessSql} INSERT INTO library_operation_receipts
        (operation_id,workspace_id,person_id,operation_name,key_hash,input_hash,item_id,revision_id,result_json,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM live_viewer) AND (${admission.sql})`)
        .bind(...accessParams(context),operationId,context.workspaceId,actor.person.id,context.operation,context.keyHash,context.inputHash,itemId,result.revision?.id ?? null,JSON.stringify(result),now,...admission.params),
      ...writes(operationId),
    ]);
    changes=batch[0].meta.changes;
  } catch(error) {
    const existing=await findReceipt(context);
    if(existing) return replay(context,existing);
    throw error;
  }
  if(changes!==1) {
    const existing=await findReceipt(context);
    if(existing) return replay(context,existing);
    const current=baseRevisionId ? await readable(context,itemId) : null;
    if(current && current.current_revision_id!==baseRevisionId) throw conflict(current.current_revision_id);
    throw new OperationError('library_changed',409,'Library access or sources changed during this operation. Refresh before retrying.');
  }
  return {result,replayed:false};
}
function and(admission,sql,...params) {admission.sql+=` AND (${sql})`;admission.params.push(...params);}

async function audienceFor(input,context) {
  const audience=input.audience ?? 'workspace';
  const personIds=[...(input.personIds ?? [])].sort();
  if(audience==='workspace' && personIds.length) throw new OperationError('invalid_input',400,'Person selections apply only to a selected audience.');
  if(audience==='selected' && !personIds.includes(context.actor.person.id)) throw new OperationError('invalid_input',400,'Keep yourself in a selected audience when changing an item.');
  const found=await context.env.CP_DB.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id=? AND status='active' AND person_id IN (SELECT value FROM json_each(?))")
    .bind(context.workspaceId,JSON.stringify(personIds)).first();
  if(found.count!==personIds.length) throw new OperationError('invalid_input',400,'Select only active workspace members.');
  return {audience,personIds};
}
function audienceAdmission(admission,personIds,context) {
  and(admission,"NOT EXISTS(SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=? AND m.person_id=selected.value AND m.status='active'))",JSON.stringify(personIds),context.workspaceId);
}
async function sourcesFor(sourceRevisions,context,itemId) {
  const sources=[...(sourceRevisions ?? [])].sort((a,b)=>a.revisionId.localeCompare(b.revisionId));
  if(new Set(sources.map(source=>source.itemId)).size!==sources.length) throw new OperationError('invalid_input',400,'Use one source revision per item.');
  for(const source of sources) await readable(context,source.itemId,source.revisionId);
  if(itemId && sources.length) {
    const cycle=await context.env.CP_DB.prepare(`WITH RECURSIVE dependencies(item_id) AS (
      SELECT value FROM json_each(?) UNION SELECT source.item_id FROM dependencies d
      JOIN library_revisions r ON r.item_id=d.item_id JOIN library_sources refs ON refs.revision_id=r.revision_id
      JOIN library_revisions source ON source.revision_id=refs.source_revision_id)
      SELECT 1 FROM dependencies WHERE item_id=?`).bind(JSON.stringify(sources.map(source=>source.itemId)),itemId).first();
    if(cycle) throw new OperationError('source_cycle',409,'A Library entry cannot depend on itself, directly or through another entry.');
  }
  return sources;
}
function sourcesAdmission(admission,sources,itemId) {
  const ids=JSON.stringify(sources.map(source=>source.revisionId));
  and(admission,'(SELECT COUNT(*) FROM accessible WHERE revision_id IN (SELECT value FROM json_each(?)))=?',ids,sources.length);
  if(itemId && sources.length) and(admission,`NOT EXISTS(WITH RECURSIVE dependencies(item_id) AS (
    SELECT value FROM json_each(?) UNION SELECT source.item_id FROM dependencies d
    JOIN library_revisions r ON r.item_id=d.item_id JOIN library_sources refs ON refs.revision_id=r.revision_id
    JOIN library_revisions source ON source.revision_id=refs.source_revision_id)
    SELECT 1 FROM dependencies WHERE item_id=?)`,JSON.stringify(sources.map(source=>source.itemId)),itemId);
}
function revisionWrites(context,row,sources,operationId) {
  const db=context.env.CP_DB;
  return [
    db.prepare(`INSERT INTO library_revisions(revision_id,item_id,revision_number,title,body_text,reason,author_person_id,author_session_id,created_at,indexing_status)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(row.revision_id,row.item_id,row.revision_number,row.title,row.body_text,row.reason,row.author_person_id,row.author_session_id,row.revision_created_at,row.indexing_status,operationId),
    db.prepare(`INSERT INTO library_sources(revision_id,source_revision_id) SELECT ?,value FROM json_each(?) WHERE ${guard}`)
      .bind(row.revision_id,JSON.stringify(sources.map(source=>source.revisionId)),operationId),
    db.prepare(`UPDATE library_items SET current_revision_id=?,updated_at=? WHERE item_id=? AND ${guard}`).bind(row.revision_id,row.updated_at,row.item_id,operationId),
    db.prepare(`DELETE FROM library_search WHERE item_id=? AND ${guard}`).bind(row.item_id,operationId),
    db.prepare(`INSERT INTO library_search(item_id,title,body_text) SELECT ?,?,? WHERE ${guard}`).bind(row.item_id,row.title,row.body_text,operationId),
  ];
}
function revisionRow(context,{title,text,reason,sources,number,indexingStatus='ready'}) {
  return {revision_id:crypto.randomUUID(),revision_number:number,title,body_text:text,reason,
    author_person_id:context.actor.person.id,author_session_id:context.actor.session.id,email:context.actor.person.email,
    author_kind:context.actor.session.kind,agent_label:context.actor.session.agentLabel,
    revision_created_at:Date.now(),sources_json:JSON.stringify(sources),indexing_status:indexingStatus};
}
async function createEntry(input,context) {
  const title=inputString(input.title,'title',200);
  inputString(input.text,'text',40000);
  const {audience,personIds}=await audienceFor(input,context);
  const sources=await sourcesFor(input.sourceRevisions,context);
  const now=Date.now();
  const row={item_id:crypto.randomUUID(),workspace_id:context.workspaceId,kind:'knowledge',status:'active',audience,
    people_json:JSON.stringify(personIds),created_by:context.actor.person.id,created_at:now,updated_at:now,
    ...revisionRow(context,{title,text:input.text,reason:'Created',sources,number:1})};
  row.current_revision_id=row.revision_id;
  const admission={sql:'1',params:[]};
  audienceAdmission(admission,personIds,context);
  sourcesAdmission(admission,sources);
  const db=context.env.CP_DB;
  return commit(context,itemResult(row),admission,operationId=>[
    db.prepare(`INSERT INTO library_items(item_id,workspace_id,kind,status,audience,created_by,created_at,updated_at)
      SELECT ?,?,'knowledge','active',?,?,?,? WHERE ${guard}`).bind(row.item_id,context.workspaceId,audience,context.actor.person.id,now,now,operationId),
    db.prepare(`INSERT INTO library_people(item_id,person_id) SELECT ?,value FROM json_each(?) WHERE ${guard}`).bind(row.item_id,JSON.stringify(personIds),operationId),
    ...revisionWrites(context,row,sources,operationId),
  ]);
}
async function reviseEntry(input,context) {
  const current=await readable(context,input.itemId);
  if(current.kind!=='knowledge' || current.status!=='active') throw new OperationError('invalid_state',409,'Only active knowledge entries can be corrected.');
  if(current.current_revision_id!==input.baseRevisionId) throw conflict(current.current_revision_id);
  inputString(input.text,'text',40000);
  const sources=await sourcesFor(input.sourceRevisions ?? JSON.parse(current.sources_json),context,current.item_id);
  const row={...current,...revisionRow(context,{title:input.title===undefined ? current.title : inputString(input.title,'title',200),text:input.text,
    reason:inputString(input.reason,'reason',1000),sources,number:current.revision_number+1}),updated_at:Date.now()};
  row.current_revision_id=row.revision_id;
  const admission={sql:"EXISTS(SELECT 1 FROM library_items i JOIN accessible a ON a.revision_id=i.current_revision_id WHERE i.item_id=? AND i.current_revision_id=? AND i.status='active' AND i.kind='knowledge')",params:[input.itemId,input.baseRevisionId]};
  sourcesAdmission(admission,sources,current.item_id);
  return commit(context,itemResult(row),admission,operationId=>revisionWrites(context,row,sources,operationId),input.baseRevisionId);
}
async function manageEntry(name,input,context) {
  const row=await readable(context,input.itemId);
  requireManage(context,row);
  const db=context.env.CP_DB;
  const admission={sql:`EXISTS(SELECT 1 FROM library_items i JOIN accessible a ON a.revision_id=i.current_revision_id
    WHERE i.item_id=? AND (i.created_by=? OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=i.workspace_id AND m.person_id=? AND m.status='active' AND m.role IN ('owner','admin'))))`,params:[row.item_id,context.actor.person.id,context.actor.person.id]};
  if(name==='library.archive') {
    const item={...itemView(row),status:'archived',updatedAt:Date.now()};
    return commit(context,{item},admission,operationId=>[
      db.prepare(`UPDATE library_items SET status='archived',updated_at=? WHERE item_id=? AND ${guard}`).bind(item.updatedAt,row.item_id,operationId),
      db.prepare(`DELETE FROM library_search WHERE item_id=? AND ${guard}`).bind(row.item_id,operationId),
    ]);
  }
  const {audience,personIds}=await audienceFor(input,context);
  audienceAdmission(admission,personIds,context);
  const item={...itemView(row),audience,personIds,updatedAt:Date.now()};
  return commit(context,{item},admission,operationId=>[
    db.prepare(`UPDATE library_items SET audience=?,updated_at=? WHERE item_id=? AND ${guard}`).bind(audience,item.updatedAt,row.item_id,operationId),
    db.prepare(`DELETE FROM library_people WHERE item_id=? AND ${guard}`).bind(row.item_id,operationId),
    db.prepare(`INSERT INTO library_people(item_id,person_id) SELECT ?,value FROM json_each(?) WHERE ${guard}`).bind(row.item_id,JSON.stringify(personIds),operationId),
  ]);
}

export async function handleLibraryOperation(name,input,context) {
  const definition=definitions[name];
  if(!definition) return null;
  const checked=validators.get(name).validate(input);
  if(!checked.valid) throw new OperationError('invalid_input',400,checked.errors.map(error=>error.error).join('; '));
  const workspaceId=inputString(input.workspaceId,'workspaceId');
  const membership=await requireMembership(context.env,workspaceId,context.actor);
  const operationContext={...context,workspaceId,membership,operation:name};
  const helpers={readable,sourcesFor,sourcesAdmission,audienceFor,audienceAdmission,commit,itemResult,revisionWrites,revisionRow,conflict};
  if(definition.effect==='read') {
    if(libraryFileOperations[name]) return handleLibraryFileOperation(name,input,operationContext,helpers);
    return readOperation(name,input,operationContext);
  }
  const key=context.idempotencyKey ?? context.request?.headers.get('Idempotency-Key');
  if(typeof key!=='string' || !key.trim() || key.length>200) throw new OperationError('idempotency_key_required',400,'Library writes need an Idempotency-Key of at most 200 characters.');
  operationContext.keyHash=await hashSecret(key);
  operationContext.inputHash=await hashSecret(JSON.stringify(canonical(input)));
  const receipt=await findReceipt(operationContext);
  if(receipt) return replay(operationContext,receipt);
  if(libraryFileOperations[name]) return handleLibraryFileOperation(name,input,operationContext,helpers);
  if(name==='library.entry.create') return createEntry(input,operationContext);
  if(name==='library.entry.revise') return reviseEntry(input,operationContext);
  return manageEntry(name,input,operationContext);
}
export class Library extends WorkerEntrypoint {
  async invoke({parentInvocationId,sourceAppId,operation,input,idempotencyKey}) {
    try {
      if(!['library.search','library.get','library.entry.create','library.entry.revise'].includes(operation)) throw new OperationError('forbidden',403,'This Library operation is not available through an app action.');
      const {parent,actor}=await resolveParentInvocation(this.env,parentInvocationId,sourceAppId);
      if(input?.workspaceId!==undefined && input.workspaceId!==parent.workspace_id) throw new OperationError('forbidden',403,'App Library calls cannot cross workspaces.');
      const outcome=await handleLibraryOperation(operation,{...input,workspaceId:parent.workspace_id},{env:this.env,actor,idempotencyKey});
      return {ok:true,result:outcome.result};
    } catch(error) {
      if(error instanceof OperationError) return {ok:false,error:{code:error.code,status:error.status,message:error.message,...(error.details ? {details:error.details} : {})}};
      throw error;
    }
  }
}
