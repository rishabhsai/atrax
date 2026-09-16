import {canonicalJson} from '../../shared/app-contract.js';
import {getApp,requireMembership} from './access.js';
import {hashSecret,normalizeEmail} from './identity.js';
import {OperationError,inputString,requireActor} from './identity-errors.js';

const invitationLifetime=7*24*60*60_000;
const receiptGuard='EXISTS(SELECT 1 FROM operation_receipts WHERE operation_id=?)';

const sorted=(values)=>[...values].sort((left,right)=>left.localeCompare(right));

function guestView(row) {
  return {personId:row.person_id,email:row.email,actionNames:JSON.parse(row.action_names_json ?? '[]'),revision:row.revision};
}

function invitationView(row) {
  return {id:row.invitation_id,email:row.email,status:row.status==='pending'&&row.expires_at<=Date.now()?'expired':row.status,actionNames:JSON.parse(row.action_names_json),expiresAt:row.expires_at,createdAt:row.created_at};
}

async function externalManager(context,appId) {
  const app=await getApp(context.env,appId);
  await requireMembership(context.env,app.workspace_id,context.actor,['owner','admin']);
  return app;
}

function adminAdmission(context,appId,extra='1',params=[]) {
  const now=Date.now();
  return {sql:`EXISTS(SELECT 1 FROM apps a JOIN workspace_members member
    ON member.workspace_id=a.workspace_id AND member.person_id=? AND member.status='active'
    JOIN sessions session ON session.session_id=? AND session.person_id=?
      AND session.revoked_at IS NULL AND session.expires_at>?
    WHERE a.app_id=? AND a.status!='deleted' AND member.role IN ('owner','admin')
      AND (session.parent_session_id IS NULL OR EXISTS(SELECT 1 FROM sessions parent
        WHERE parent.session_id=session.parent_session_id AND parent.revoked_at IS NULL AND parent.expires_at>?))
      AND (${extra}))`,params:[context.actor.person.id,context.actor.session.id,context.actor.person.id,now,appId,now,...params]};
}

async function receipt(context,name,targetId,input) {
  const key=inputString(context.idempotencyKey,'Idempotency-Key',200);
  const inputHash=await hashSecret(canonicalJson(input));
  const row=await context.env.CP_DB.prepare('SELECT input_hash,result_json FROM operation_receipts WHERE person_id=? AND operation=? AND target_id=? AND idempotency_key=?')
    .bind(context.actor.person.id,name,targetId,key).first();
  if(!row) return {key,inputHash};
  if(row.input_hash!==inputHash) throw new OperationError('idempotency_conflict',409,'This idempotency key was already used with different input.');
  return {result:JSON.parse(row.result_json)};
}

async function commit(context,{name,targetId,appId,input,result,admission,writes}) {
  const previous=await receipt(context,name,targetId,input);
  if(previous.result) return previous.result;
  const operationId=crypto.randomUUID(),now=Date.now();
  try {
    const batch=await context.env.CP_DB.batch([
      context.env.CP_DB.prepare(`INSERT INTO operation_receipts(operation_id,person_id,operation,target_id,idempotency_key,input_hash,result_json,created_at)
        SELECT ?,?,?,?,?,?,?,? WHERE ${admission.sql}`)
        .bind(operationId,context.actor.person.id,name,targetId,previous.key,previous.inputHash,JSON.stringify(result),now,...admission.params),
      ...writes(operationId,now),
      context.env.CP_DB.prepare(`INSERT INTO activity(activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,details_json,created_at)
        SELECT ?,workspace_id,?,?,?,?,'succeeded',?,? FROM apps WHERE app_id=? AND ${receiptGuard}`)
        .bind(crypto.randomUUID(),context.actor.person.id,context.actor.session.id,name,targetId,JSON.stringify(result),now,appId,operationId),
    ]);
    if(batch[0].meta.changes!==1) throw new OperationError('external_sharing_changed',409,'Your access or this app changed. Refresh and try again.');
  } catch(error) {
    const concurrent=await receipt(context,name,targetId,input);
    if(concurrent.result) return concurrent.result;
    throw error;
  }
  return result;
}

async function grantableActionNames(env,app) {
  if(!app.active_release_id) return [];
  const release=await env.CP_DB.prepare('SELECT actions_json FROM releases WHERE release_id=? AND app_id=?').bind(app.active_release_id,app.app_id).first();
  if(!release) return [];
  const activeNames=[...new Set(JSON.parse(release.actions_json).map(action=>action.name))].sort();
  if(!activeNames.length) return [];
  const policies=await env.CP_DB.prepare(`SELECT action_name FROM action_policies WHERE app_id=?
    AND action_name IN (SELECT value FROM json_each(?))`).bind(app.app_id,JSON.stringify(activeNames)).all();
  const published=new Set(policies.results.map(policy=>policy.action_name));
  return activeNames.filter(name=>published.has(name));
}

async function guestActionsArePublished(env,app,actionNames) {
  const grantable=new Set(await grantableActionNames(env,app));
  if(actionNames.some(actionName=>!grantable.has(actionName))) {
    throw new OperationError('action_not_found',404,'Choose only actions currently published by this app.');
  }
}

function publishedActionAdmission(actionNames) {
  return {sql:`NOT EXISTS(SELECT 1 FROM json_each(?) requested WHERE NOT EXISTS(
    SELECT 1 FROM releases release JOIN json_each(release.actions_json) action
    JOIN action_policies policy ON policy.app_id=a.app_id AND policy.action_name=json_extract(action.value,'$.name')
    WHERE release.release_id=a.active_release_id AND release.app_id=a.app_id
      AND policy.action_name=requested.value))`,params:[JSON.stringify(actionNames)]};
}

async function deliverInvitation(env,invitationId) {
  const row=await env.CP_DB.prepare(`SELECT invitation_id,email,expires_at,delivered_at,a.name app_name
    FROM app_guest_invitations i JOIN apps a ON a.app_id=i.app_id
    WHERE i.invitation_id=? AND i.status='pending' AND i.expires_at>?`).bind(invitationId,Date.now()).first();
  if(!row || row.delivered_at) return;
  if(!env.EMAIL||!env.EMAIL_FROM||!env.CONSOLE_ORIGIN) throw new OperationError('email_unavailable',503,'Guest invitation email is not configured.');
  const link=new URL('/auth/guest-invite',env.CONSOLE_ORIGIN);
  link.searchParams.set('id',invitationId);
  try {
    await env.EMAIL.send({to:row.email,from:{email:env.EMAIL_FROM,name:'Atrax'},subject:`Access ${row.app_name} on Atrax`,
      text:`You have been invited to use ${row.app_name} on Atrax. Sign in with this email address, then accept the invitation.\n${link.href}\n\nThis invitation expires in 7 days.`});
  } catch {
    throw new OperationError('email_unavailable',503,'The guest invitation was saved, but its email could not be sent. Retry this operation to send it.',{invitationId});
  }
  await env.CP_DB.prepare('UPDATE app_guest_invitations SET delivered_at=COALESCE(delivered_at,?) WHERE invitation_id=?').bind(Date.now(),invitationId).run();
}

async function listGuests(input,context) {
  await externalManager(context,input.appId);
  const observedAt=Date.now(),db=context.env.CP_DB;
  // D1 executes this read batch in one transaction, keeping the audience coherent.
  const [apps,people,guests,invitations,grantable]=await db.batch([
    db.prepare("SELECT workspace_id,audience,public_web FROM apps WHERE app_id=? AND status!='deleted'").bind(input.appId),
    db.prepare(`SELECT p.person_id,p.email,m.role FROM apps a
      JOIN workspace_members m ON m.workspace_id=a.workspace_id AND m.status='active'
      JOIN people p ON p.person_id=m.person_id WHERE a.app_id=?
      AND (a.audience='workspace' OR EXISTS(SELECT 1 FROM app_people selected WHERE selected.app_id=a.app_id AND selected.person_id=m.person_id))
      ORDER BY p.email`).bind(input.appId),
    db.prepare(`SELECT g.person_id,g.revision,p.email,
      COALESCE((SELECT json_group_array(action_name) FROM (SELECT action_name FROM app_guest_actions WHERE app_id=g.app_id AND person_id=g.person_id ORDER BY action_name)),'[]') action_names_json
      FROM app_guests g JOIN people p ON p.person_id=g.person_id
      WHERE g.app_id=? AND (g.expires_at IS NULL OR g.expires_at>?) ORDER BY p.email`).bind(input.appId,observedAt),
    db.prepare(`SELECT invitation_id,email,
      CASE WHEN status='pending' AND expires_at<=? THEN 'expired' ELSE status END status,
      action_names_json,expires_at,created_at
      FROM app_guest_invitations WHERE app_id=? ORDER BY created_at DESC`).bind(observedAt,input.appId),
    db.prepare(`SELECT DISTINCT policy.action_name FROM apps a
      JOIN releases release ON release.release_id=a.active_release_id AND release.app_id=a.app_id
      JOIN json_each(release.actions_json) action
      JOIN action_policies policy ON policy.app_id=a.app_id AND policy.action_name=json_extract(action.value,'$.name')
      WHERE a.app_id=? ORDER BY policy.action_name`).bind(input.appId),
  ]);
  const app=apps.results[0];
  if(!app) throw new OperationError('not_found',404,'App not found');
  return {result:{appId:input.appId,observedAt,
    audience:{publicWeb:app.public_web===1,workspace:{id:app.workspace_id,policy:app.audience,
      people:people.results.map(row=>({personId:row.person_id,email:row.email,role:row.role}))}},
    guests:guests.results.map(guestView),invitations:invitations.results.map(invitationView),
    grantableActionNames:grantable.results.map(row=>row.action_name)}};
}

async function inviteGuest(input,context) {
  const app=await externalManager(context,input.appId);
  const email=normalizeEmail(input.email),actionNames=sorted(input.actionNames);
  await guestActionsArePublished(context.env,app,actionNames);
  const member=await context.env.CP_DB.prepare(`SELECT 1 FROM workspace_members m JOIN people p ON p.person_id=m.person_id
    WHERE m.workspace_id=? AND m.status='active' AND p.email=?`).bind(app.workspace_id,email).first();
  if(member) throw new OperationError('invalid_guest',400,'Workspace members already have app access; guests must be outside the workspace.');
  const invitationId=crypto.randomUUID(),now=Date.now();
  const normalized={appId:input.appId,email,actionNames};
  const published=publishedActionAdmission(actionNames);
  const result={invitation:{id:invitationId,email,status:'pending',actionNames,expiresAt:now+invitationLifetime}};
  const committed=await commit(context,{name:'apps.guests.invite',targetId:input.appId,appId:input.appId,input:normalized,result,
    admission:adminAdmission(context,input.appId,`NOT EXISTS(SELECT 1 FROM workspace_members member JOIN people person ON person.person_id=member.person_id
      WHERE member.workspace_id=a.workspace_id AND member.status='active' AND person.email=?)
      AND (${published.sql})`,[email,...published.params]),
    writes:(operationId)=>[
      context.env.CP_DB.prepare(`UPDATE app_guest_invitations SET status='revoked' WHERE app_id=? AND email=? AND status='pending' AND ${receiptGuard}`).bind(input.appId,email,operationId),
      context.env.CP_DB.prepare(`INSERT INTO app_guest_invitations(invitation_id,app_id,email,action_names_json,status,expires_at,created_by,created_at)
        SELECT ?,?,?,?,'pending',?,?,? WHERE ${receiptGuard}`).bind(invitationId,input.appId,email,JSON.stringify(actionNames),now+invitationLifetime,context.actor.person.id,now,operationId),
    ],
  });
  await deliverInvitation(context.env,committed.invitation.id);
  return {result:committed};
}

async function cancelGuestInvitation(input,context) {
  await externalManager(context,input.appId);
  const previous=await receipt(context,'apps.guests.invitation.cancel',input.invitationId,input);
  if(previous.result) return {result:previous.result};
  const invitation=await context.env.CP_DB.prepare('SELECT * FROM app_guest_invitations WHERE invitation_id=? AND app_id=?')
    .bind(input.invitationId,input.appId).first();
  if(!invitation) throw new OperationError('not_found',404,'This guest invitation was not found.');
  const status=invitationView(invitation).status;
  if(status!=='pending') throw new OperationError('invitation_not_pending',409,`This invitation is ${status} and cannot be cancelled.`,{status});
  const result={invitation:{...invitationView(invitation),status:'cancelled'}};
  return {result:await commit(context,{name:'apps.guests.invitation.cancel',targetId:input.invitationId,appId:input.appId,input,result,
    admission:adminAdmission(context,input.appId,`EXISTS(SELECT 1 FROM app_guest_invitations invitation
      WHERE invitation.app_id=a.app_id AND invitation.invitation_id=? AND invitation.status='pending' AND invitation.expires_at>?)`,[input.invitationId,Date.now()]),
    writes:(operationId)=>[context.env.CP_DB.prepare(`UPDATE app_guest_invitations SET status='cancelled'
      WHERE invitation_id=? AND app_id=? AND ${receiptGuard}`).bind(input.invitationId,input.appId,operationId)],
  })};
}

async function setGuestActions(input,context) {
  const app=await externalManager(context,input.appId);
  const actionNames=sorted(input.actionNames);
  const normalized={...input,actionNames};
  const previous=await receipt(context,'apps.guests.actions.set',input.appId,normalized);
  if(previous.result) return {result:previous.result};
  const guest=await context.env.CP_DB.prepare(`SELECT g.*,p.email FROM app_guests g JOIN people p ON p.person_id=g.person_id
    WHERE g.app_id=? AND g.person_id=? AND (g.expires_at IS NULL OR g.expires_at>?)`)
    .bind(input.appId,input.personId,Date.now()).first();
  if(!guest) throw new OperationError('guest_not_found',404,'This person no longer has guest access to this app.');
  if(guest.revision!==input.revision) throw new OperationError('guest_revision_conflict',409,'Guest access changed. Review the current grants before saving your draft.',{currentRevision:guest.revision});
  await guestActionsArePublished(context.env,app,actionNames);
  const result={guest:{personId:input.personId,email:guest.email,actionNames,revision:guest.revision+1}};
  const published=publishedActionAdmission(actionNames);
  try {
    return {result:await commit(context,{name:'apps.guests.actions.set',targetId:input.appId,appId:input.appId,input:normalized,result,
      admission:adminAdmission(context,input.appId,`EXISTS(SELECT 1 FROM app_guests guest
        WHERE guest.app_id=a.app_id AND guest.person_id=? AND guest.revision=? AND (guest.expires_at IS NULL OR guest.expires_at>?)) AND (${published.sql})`,
      [input.personId,input.revision,Date.now(),...published.params]),
      writes:(operationId)=>[
        context.env.CP_DB.prepare(`DELETE FROM app_guest_actions WHERE app_id=? AND person_id=? AND ${receiptGuard}`).bind(input.appId,input.personId,operationId),
        context.env.CP_DB.prepare(`INSERT INTO app_guest_actions(app_id,person_id,action_name) SELECT ?,?,value FROM json_each(?) WHERE ${receiptGuard}`)
          .bind(input.appId,input.personId,JSON.stringify(actionNames),operationId),
        context.env.CP_DB.prepare(`UPDATE app_guests SET revision=revision+1 WHERE app_id=? AND person_id=? AND ${receiptGuard}`).bind(input.appId,input.personId,operationId),
      ],
    })};
  } catch(error) {
    if(error.code!=='external_sharing_changed') throw error;
    await externalManager(context,input.appId);
    const current=await context.env.CP_DB.prepare('SELECT revision FROM app_guests WHERE app_id=? AND person_id=?').bind(input.appId,input.personId).first();
    if(current&&current.revision!==input.revision) throw new OperationError('guest_revision_conflict',409,'Guest access changed. Review the current grants before saving your draft.',{currentRevision:current.revision});
    throw error;
  }
}

async function acceptGuest(input,context) {
  requireActor(context.actor);
  const invitation=await context.env.CP_DB.prepare('SELECT * FROM app_guest_invitations WHERE invitation_id=?').bind(input.invitationId).first();
  if(!invitation) throw new OperationError('not_found',404,'This guest invitation was not found.');
  if(invitation.email!==context.actor.person.email) throw new OperationError('invitation_email_mismatch',403,'Sign in with the email address this invitation was sent to.');
  if(invitation.status==='cancelled') throw new OperationError('invitation_cancelled',410,'This guest invitation was cancelled. Ask the workspace administrator for a new invitation.');
  if(invitation.status==='revoked') throw new OperationError('invitation_revoked',410,'This guest invitation was revoked. Ask the workspace administrator for a new invitation.');
  if(invitation.expires_at<=Date.now()) throw new OperationError('invitation_expired',410,'This guest invitation has expired. Ask the workspace administrator for a new invitation.');
  const app=await getApp(context.env,invitation.app_id);
  const membership=await context.env.CP_DB.prepare('SELECT 1 FROM workspace_members WHERE workspace_id=? AND person_id=? AND status=\'active\'').bind(app.workspace_id,context.actor.person.id).first();
  if(membership) throw new OperationError('invalid_guest',400,'Workspace members cannot accept a guest invitation.');
  const previous=await receipt(context,'apps.guests.accept',input.invitationId,input);
  if(previous.result) {
    const guest=await context.env.CP_DB.prepare('SELECT 1 FROM app_guests WHERE app_id=? AND person_id=? AND (expires_at IS NULL OR expires_at>?)').bind(app.app_id,context.actor.person.id,Date.now()).first();
    if(!guest) throw new OperationError('invitation_revoked',410,'This guest invitation was revoked. Ask the workspace administrator for a new invitation.');
    const grants=await context.env.CP_DB.prepare('SELECT action_name FROM app_guest_actions WHERE app_id=? AND person_id=? ORDER BY action_name').bind(app.app_id,context.actor.person.id).all();
    return {result:{guest:{appId:app.app_id,personId:context.actor.person.id,email:context.actor.person.email,actionNames:grants.results.map(grant=>grant.action_name)}}};
  }
  if(invitation.status==='accepted') throw new OperationError('invitation_accepted',409,'This guest invitation was already accepted.');
  const actionNames=JSON.parse(invitation.action_names_json);
  const result={guest:{appId:app.app_id,personId:context.actor.person.id,email:context.actor.person.email,actionNames}};
  const now=Date.now();
  const admission={sql:`EXISTS(SELECT 1 FROM app_guest_invitations invitation JOIN sessions session
      ON session.session_id=? AND session.person_id=? AND session.revoked_at IS NULL AND session.expires_at>?
      WHERE invitation.invitation_id=? AND invitation.email=? AND invitation.status='pending' AND invitation.expires_at>?
        AND NOT EXISTS(SELECT 1 FROM workspace_members member JOIN apps candidate ON candidate.workspace_id=member.workspace_id
          WHERE candidate.app_id=invitation.app_id AND member.person_id=? AND member.status='active'))`,
  params:[context.actor.session.id,context.actor.person.id,now,input.invitationId,context.actor.person.email,now,context.actor.person.id]};
  const committed=await commit(context,{name:'apps.guests.accept',targetId:input.invitationId,appId:app.app_id,input,result,admission,
    writes:(operationId)=>[
      context.env.CP_DB.prepare(`INSERT INTO app_guests(app_id,person_id)
        SELECT app_id,? FROM app_guest_invitations WHERE invitation_id=? AND ${receiptGuard}
        ON CONFLICT(app_id,person_id) DO UPDATE SET revision=app_guests.revision+1,expires_at=NULL`)
        .bind(context.actor.person.id,input.invitationId,operationId),
      context.env.CP_DB.prepare(`DELETE FROM app_guest_actions WHERE app_id=? AND person_id=? AND ${receiptGuard}`).bind(app.app_id,context.actor.person.id,operationId),
      context.env.CP_DB.prepare(`INSERT INTO app_guest_actions(app_id,person_id,action_name)
        SELECT ?,?,value FROM json_each(?) WHERE ${receiptGuard}`).bind(app.app_id,context.actor.person.id,JSON.stringify(actionNames),operationId),
      context.env.CP_DB.prepare(`UPDATE app_guest_invitations SET status='accepted',accepted_by=? WHERE invitation_id=? AND ${receiptGuard}`).bind(context.actor.person.id,input.invitationId,operationId),
    ],
  });
  return {result:committed};
}

async function revokeGuest(input,context) {
  await externalManager(context,input.appId);
  const result={appId:input.appId,personId:input.personId,revoked:true};
  return {result:await commit(context,{name:'apps.guests.revoke',targetId:input.appId,appId:input.appId,input,result,
    admission:adminAdmission(context,input.appId,'EXISTS(SELECT 1 FROM app_guests guest WHERE guest.app_id=a.app_id AND guest.person_id=?)',[input.personId]),
    writes:(operationId)=>[
      context.env.CP_DB.prepare(`DELETE FROM app_guest_actions WHERE app_id=? AND person_id=? AND ${receiptGuard}`).bind(input.appId,input.personId,operationId),
      context.env.CP_DB.prepare(`DELETE FROM app_guests WHERE app_id=? AND person_id=? AND ${receiptGuard}`).bind(input.appId,input.personId,operationId),
      context.env.CP_DB.prepare(`UPDATE app_guest_invitations SET status='revoked' WHERE app_id=?
        AND email=(SELECT email FROM people WHERE person_id=?) AND status IN ('pending','accepted') AND ${receiptGuard}`)
        .bind(input.appId,input.personId,operationId),
    ],
  })};
}

function publicView(app) {return {appId:app.app_id,public:app.public_web===1,publicationRevision:app.public_revision,activeReleaseId:app.active_release_id};}

async function getPublic(input,context) {
  const app=await externalManager(context,input.appId);
  return {result:{publication:publicView(app)}};
}

async function publish(input,context) {
  const app=await externalManager(context,input.appId);
  if(input.confirmation!=='publish') throw new OperationError('confirmation_required',400,'Confirm public publishing with confirmation: publish.');
  if(app.active_release_id!==input.releaseId) throw new OperationError('release_changed',409,'The live release changed. Review it before publishing.');
  if(app.public_revision!==input.publicationRevision) throw new OperationError('publication_revision_conflict',409,'Public web settings changed. Review them before publishing.',{currentRevision:app.public_revision});
  const result={publication:{appId:app.app_id,public:true,publicationRevision:app.public_revision+1,activeReleaseId:app.active_release_id}};
  return {result:await commit(context,{name:'apps.public.publish',targetId:input.appId,appId:input.appId,input,result,
    admission:adminAdmission(context,input.appId,'a.active_release_id=? AND a.public_revision=?',[input.releaseId,input.publicationRevision]),
    writes:(operationId,now)=>[context.env.CP_DB.prepare(`UPDATE apps SET public_web=1,public_revision=public_revision+1,updated_at=? WHERE app_id=? AND ${receiptGuard}`).bind(now,input.appId,operationId)],
  })};
}

async function unpublish(input,context) {
  const app=await externalManager(context,input.appId);
  if(input.confirmation!=='unpublish') throw new OperationError('confirmation_required',400,'Confirm removing public access with confirmation: unpublish.');
  if(app.public_revision!==input.publicationRevision) throw new OperationError('publication_revision_conflict',409,'Public web settings changed. Review them before removing public access.',{currentRevision:app.public_revision});
  if(app.public_web!==1) throw new OperationError('not_public',409,'This app is not publicly published.');
  const result={publication:{appId:app.app_id,public:false,publicationRevision:app.public_revision+1,activeReleaseId:app.active_release_id}};
  return {result:await commit(context,{name:'apps.public.unpublish',targetId:input.appId,appId:input.appId,input,result,
    admission:adminAdmission(context,input.appId,'a.public_web=1 AND a.public_revision=?',[input.publicationRevision]),
    writes:(operationId,now)=>[context.env.CP_DB.prepare(`UPDATE apps SET public_web=0,public_revision=public_revision+1,updated_at=? WHERE app_id=? AND ${receiptGuard}`).bind(now,input.appId,operationId)],
  })};
}

export async function handleExternalSharingOperation(name,input,context) {
  if(name==='apps.guests.list') return listGuests(input,context);
  if(name==='apps.guests.invite') return inviteGuest(input,context);
  if(name==='apps.guests.invitation.cancel') return cancelGuestInvitation(input,context);
  if(name==='apps.guests.actions.set') return setGuestActions(input,context);
  if(name==='apps.guests.accept') return acceptGuest(input,context);
  if(name==='apps.guests.revoke') return revokeGuest(input,context);
  if(name==='apps.public.get') return getPublic(input,context);
  if(name==='apps.public.publish') return publish(input,context);
  if(name==='apps.public.unpublish') return unpublish(input,context);
  return null;
}
