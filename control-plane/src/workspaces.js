import { OperationError, inputObject, inputString, requireActor } from "./identity-errors.js";
import { hashSecret, normalizeEmail, listPersonWorkspaces } from "./identity.js";

const invitationLifetime = 7 * 24 * 60 * 60_000;
const writeGuard = "EXISTS (SELECT 1 FROM workspace_operation_receipts WHERE operation_id = ?)";

function workspaceView(row) {
  return { id: row.workspace_id, name: row.name, slug: row.slug };
}

function workspaceResult(row, personId) {
  const administer = row.role === "owner" || row.role === "admin";
  return {
    workspace: workspaceView(row),
    membership: { personId, role: row.role },
    capabilities: { createApps: true, manageMembers: administer, manageExternalSharing: administer, transferOwnership: row.role === "owner" },
  };
}

export async function requireWorkspaceMembership(env, actor, workspaceId, roles) {
  requireActor(actor);
  const row = await env.CP_DB.prepare(
    `SELECT w.workspace_id, w.name, w.slug, m.role FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.workspace_id
     WHERE w.workspace_id = ? AND m.person_id = ? AND m.status = 'active'`,
  ).bind(workspaceId, actor.person.id).first();
  if (!row || (roles && !roles.includes(row.role))) throw new OperationError("forbidden", 403, "You do not have permission for this workspace operation.");
  return row;
}

function membershipAdmission(workspaceId, personId, roles = ["owner", "admin"]) {
  return { sql: `EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND person_id = ? AND status = 'active' AND role IN (${roles.map(() => "?").join(",")}))`, params: [workspaceId, personId, ...roles] };
}

function matchingReceipt(row, inputHash) {
  if (row.input_hash !== inputHash) throw new OperationError("idempotency_conflict", 409, "This idempotency key was already used with different input.");
  return JSON.parse(row.result_json);
}

async function commit(context, name, input, workspaceId, result, admission, writes) {
  const { env, actor, request } = context;
  const key = inputString(context.idempotencyKey ?? request.headers.get("idempotency-key"), "Idempotency-Key", 200);
  const keyHash = await hashSecret(key);
  const inputHash = await hashSecret(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))));
  const receiptQuery = () => env.CP_DB.prepare("SELECT input_hash, result_json FROM workspace_operation_receipts WHERE person_id = ? AND operation_name = ? AND key_hash = ?")
    .bind(actor.person.id, name, keyHash).first();
  const previous = await receiptQuery();
  if (previous) return matchingReceipt(previous, inputHash);
  const operationId = crypto.randomUUID();
  const now = Date.now();
  let completed;
  try {
    completed = await env.CP_DB.batch([
      env.CP_DB.prepare(`INSERT INTO workspace_operation_receipts
        (operation_id, workspace_id, person_id, session_id, operation_name, key_hash, input_hash, result_json, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (${admission.sql})
          AND EXISTS (SELECT 1 FROM sessions WHERE session_id = ? AND person_id = ? AND revoked_at IS NULL AND expires_at > ?)`)
        .bind(operationId, workspaceId, actor.person.id, actor.session.id, name, keyHash, inputHash, JSON.stringify(result), now, ...admission.params, actor.session.id, actor.person.id, now),
      ...writes(operationId),
      env.CP_DB.prepare("SELECT operation_id FROM workspace_operation_receipts WHERE operation_id = ?").bind(operationId),
    ]);
  } catch (error) {
    const concurrent = await receiptQuery();
    if (concurrent) return matchingReceipt(concurrent, inputHash);
    if (String(error.message).includes("UNIQUE constraint failed")) throw new OperationError("conflict", 409, "This workspace or invitation already exists. Refresh and try again.");
    throw error;
  }
  if (!completed.at(-1).results.length) throw new OperationError("workspace_changed", 409, "Workspace access changed while this operation was running. Refresh and try again.");
  return result;
}

async function createWorkspace(input, context) {
  inputObject(input, ["name", "slug"]);
  const { env, actor } = context;
  requireActor(actor);
  const name = inputString(input.name, "name", 100);
  const slug = inputString(input.slug, "slug", 48).toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(slug)) throw new OperationError("invalid_input", 400, "Workspace slugs use 2 to 48 lowercase letters, numbers, and hyphens.");
  const workspaceId = crypto.randomUUID();
  const now = Date.now();
  const result = workspaceResult({ workspace_id: workspaceId, name, slug, role: "owner" }, actor.person.id);
  return { result: await commit(context, "workspaces.create", { name, slug }, workspaceId, result, { sql: "1", params: [] }, (operationId) => [
    env.CP_DB.prepare(`INSERT INTO workspaces (workspace_id, name, slug, created_by, created_at) SELECT ?, ?, ?, ?, ? WHERE ${writeGuard}`)
      .bind(workspaceId, name, slug, actor.person.id, now, operationId),
    env.CP_DB.prepare(`INSERT INTO workspace_members (workspace_id, person_id, role, status, joined_at) SELECT ?, ?, 'owner', 'active', ? WHERE ${writeGuard}`)
      .bind(workspaceId, actor.person.id, now, operationId),
  ]) };
}

async function listWorkspaces(input, { env, actor }) {
  inputObject(input, []);
  requireActor(actor);
  const invitations = await env.CP_DB.prepare(`SELECT i.invitation_id, i.workspace_id, i.role, i.expires_at, w.name
    FROM invitations i JOIN workspaces w ON w.workspace_id = i.workspace_id
    WHERE i.email = ? AND i.status = 'pending' AND i.expires_at > ? ORDER BY i.created_at`)
    .bind(actor.person.email, Date.now()).all();
  return { result: {
    workspaces: await listPersonWorkspaces(env, actor.person.id),
    invitations: invitations.results.map((row) => ({ id: row.invitation_id, workspaceId: row.workspace_id, workspaceName: row.name, role: row.role, expiresAt: row.expires_at })),
  } };
}

async function getWorkspace(input, { env, actor }) {
  inputObject(input, ["workspaceId"]);
  const row = await requireWorkspaceMembership(env, actor, inputString(input.workspaceId, "workspaceId"));
  return { result: workspaceResult(row, actor.person.id) };
}

function invitationView(row) {
  return { id: row.invitation_id, email: row.email, role: row.role, status: row.status, expiresAt: row.expires_at };
}

async function listMembers(input, { env, actor }) {
  inputObject(input, ["workspaceId"]);
  const workspaceId = inputString(input.workspaceId, "workspaceId");
  const membership = await requireWorkspaceMembership(env, actor, workspaceId);
  const members = await env.CP_DB.prepare(`SELECT m.person_id, p.email, m.role, m.status FROM workspace_members m
    JOIN people p ON p.person_id = m.person_id WHERE m.workspace_id = ? AND m.status = 'active' ORDER BY m.joined_at, p.email`)
    .bind(workspaceId).all();
  const invitations = membership.role === "member" ? [] : (await env.CP_DB.prepare("SELECT invitation_id, email, role, status, expires_at FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC")
    .bind(workspaceId).all()).results;
  return { result: {
    members: members.results.map((row) => ({ personId: row.person_id, email: row.email, role: row.role, status: row.status })),
    invitations: invitations.map(invitationView),
  } };
}

async function deliverInvitation(env, invitationId) {
  const row = await env.CP_DB.prepare(`SELECT i.*, w.name FROM invitations i JOIN workspaces w ON w.workspace_id = i.workspace_id
    WHERE invitation_id = ? AND i.status = 'pending' AND i.delivered_at IS NULL AND i.expires_at > ?`).bind(invitationId, Date.now()).first();
  if (!row) return;
  const link = new URL("/auth/invite", env.CONSOLE_ORIGIN);
  link.searchParams.set("id", invitationId);
  try {
    await env.EMAIL.send({ to: row.email, from: { email: env.EMAIL_FROM, name: "Atrax" }, subject: "Join your team on Atrax",
      text: `You have been invited to ${row.name} on Atrax.\n${link.href}\n\nSign in with this email address to accept. The invitation expires in 7 days.`,
    });
  } catch {
    throw new OperationError("email_unavailable", 503, "The invitation was saved, but its email could not be sent. Retry this operation to send it.", { invitationId });
  }
  await env.CP_DB.prepare("UPDATE invitations SET delivered_at = COALESCE(delivered_at, ?) WHERE invitation_id = ?").bind(Date.now(), invitationId).run();
}

async function inviteMember(input, context) {
  inputObject(input, ["workspaceId", "email", "role"]);
  const { env, actor } = context;
  const workspaceId = inputString(input.workspaceId, "workspaceId");
  await requireWorkspaceMembership(env, actor, workspaceId, ["owner", "admin"]);
  const email = normalizeEmail(input.email);
  const role = input.role ?? "member";
  if (!["admin", "member"].includes(role)) throw new OperationError("invalid_input", 400, "Invitation role must be admin or member.");
  if (!env.EMAIL || !env.EMAIL_FROM || !env.CONSOLE_ORIGIN) throw new OperationError("email_unavailable", 503, "Invitation email is not configured.");
  const admission = membershipAdmission(workspaceId, actor.person.id);
  admission.sql += " AND NOT EXISTS (SELECT 1 FROM workspace_members m JOIN people p ON p.person_id = m.person_id WHERE m.workspace_id = ? AND p.email = ? AND m.status = 'active')";
  admission.params.push(workspaceId, email);
  const invitationId = crypto.randomUUID();
  const now = Date.now();
  const result = { invitation: { id: invitationId, email, role, status: "pending", expiresAt: now + invitationLifetime } };
  const committed = await commit(context, "members.invite", { workspaceId, email, role }, workspaceId, result, admission, (operationId) => [
    env.CP_DB.prepare(`UPDATE invitations SET status = 'revoked' WHERE workspace_id = ? AND email = ? AND status = 'pending' AND ${writeGuard}`).bind(workspaceId, email, operationId),
    env.CP_DB.prepare(`INSERT INTO invitations (invitation_id, workspace_id, email, role, status, expires_at, created_by, created_at)
      SELECT ?, ?, ?, ?, 'pending', ?, ?, ? WHERE ${writeGuard}`)
      .bind(invitationId, workspaceId, email, role, now + invitationLifetime, actor.person.id, now, operationId),
  ]);
  await deliverInvitation(env, committed.invitation.id);
  return { result: committed };
}

async function acceptInvitation(input, context) {
  inputObject(input, ["invitationId"]);
  const { env, actor } = context;
  requireActor(actor);
  const invitationId = inputString(input.invitationId, "invitationId");
  const invitation = await env.CP_DB.prepare("SELECT i.*, w.name, w.slug FROM invitations i JOIN workspaces w ON w.workspace_id = i.workspace_id WHERE invitation_id = ?")
    .bind(invitationId).first();
  if (!invitation) throw new OperationError("not_found", 404, "This invitation was not found.");
  if (invitation.email !== actor.person.email) throw new OperationError("invitation_email_mismatch", 403, "Sign in with the email address this invitation was sent to.");
  if (invitation.status === "accepted") return getWorkspace({ workspaceId: invitation.workspace_id }, context);
  if (invitation.status !== "pending" || invitation.expires_at <= Date.now()) throw new OperationError("invitation_expired", 410, "This invitation is expired or revoked. Ask your workspace admin for another.");
  const now = Date.now();
  const result = workspaceResult(invitation, actor.person.id);
  const admission = { sql: "EXISTS (SELECT 1 FROM invitations WHERE invitation_id = ? AND email = ? AND status = 'pending' AND expires_at > ?)", params: [invitationId, actor.person.email, now] };
  return { result: await commit(context, "members.accept", { invitationId }, invitation.workspace_id, result, admission, (operationId) => [
    env.CP_DB.prepare(`INSERT INTO workspace_members (workspace_id, person_id, role, status, joined_at)
      SELECT ?, ?, ?, 'active', ? WHERE ${writeGuard}
      ON CONFLICT(workspace_id, person_id) DO UPDATE SET role = excluded.role, status = 'active', joined_at = excluded.joined_at, removed_at = NULL`)
      .bind(invitation.workspace_id, actor.person.id, invitation.role, now, operationId),
    env.CP_DB.prepare(`UPDATE invitations SET status = 'accepted', accepted_by = ? WHERE invitation_id = ? AND ${writeGuard}`)
      .bind(actor.person.id, invitationId, operationId),
  ]) };
}

async function removeMember(input, context) {
  inputObject(input, ["workspaceId", "personId"]);
  const { env, actor } = context;
  const workspaceId = inputString(input.workspaceId, "workspaceId");
  const personId = inputString(input.personId, "personId");
  await requireWorkspaceMembership(env, actor, workspaceId, ["owner", "admin"]);
  const target = await env.CP_DB.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND person_id = ?").bind(workspaceId, personId).first();
  if (!target) throw new OperationError("not_found", 404, "This member was not found.");
  if (target.role === "owner") throw new OperationError("last_owner", 409, "Transfer workspace ownership before removing its owner.");
  const admission = membershipAdmission(workspaceId, actor.person.id);
  admission.sql += " AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND person_id = ? AND role != 'owner')";
  admission.params.push(workspaceId, personId);
  return { result: await commit(context, "members.remove", { workspaceId, personId }, workspaceId, { workspaceId, personId, removed: true }, admission, (operationId) => [
    env.CP_DB.prepare(`UPDATE workspace_members SET status = 'removed', removed_at = COALESCE(removed_at, ?) WHERE workspace_id = ? AND person_id = ? AND ${writeGuard}`)
      .bind(Date.now(), workspaceId, personId, operationId),
    env.CP_DB.prepare(`UPDATE invitations SET status = 'revoked' WHERE workspace_id = ? AND email = (SELECT email FROM people WHERE person_id = ?) AND status = 'pending' AND ${writeGuard}`)
      .bind(workspaceId, personId, operationId),
  ]) };
}

async function setMemberRole(input, context) {
  inputObject(input, ["workspaceId", "personId", "role"]);
  const { env, actor } = context;
  const workspaceId = inputString(input.workspaceId, "workspaceId");
  const personId = inputString(input.personId, "personId");
  const role = input.role;
  if (!["admin", "member"].includes(role)) throw new OperationError("invalid_input", 400, "Use admin or member. Transfer ownership through workspaces.transferOwnership.");
  await requireWorkspaceMembership(env, actor, workspaceId, ["owner", "admin"]);
  const target = await env.CP_DB.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND person_id = ? AND status = 'active'").bind(workspaceId, personId).first();
  if (!target) throw new OperationError("not_found", 404, "This active member was not found.");
  if (target.role === "owner") throw new OperationError("last_owner", 409, "Transfer ownership before changing the owner's role.");
  const admission = membershipAdmission(workspaceId, actor.person.id);
  admission.sql += " AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND person_id = ? AND status = 'active' AND role != 'owner')";
  admission.params.push(workspaceId, personId);
  return { result: await commit(context, "members.setRole", { workspaceId, personId, role }, workspaceId, { workspaceId, personId, role }, admission, (operationId) => [
    env.CP_DB.prepare(`UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND person_id = ? AND ${writeGuard}`)
      .bind(role, workspaceId, personId, operationId),
  ]) };
}

async function transferOwnership(input, context) {
  inputObject(input, ["workspaceId", "personId"]);
  const { env, actor } = context;
  const workspaceId = inputString(input.workspaceId, "workspaceId");
  const personId = inputString(input.personId, "personId");
  await requireWorkspaceMembership(env, actor, workspaceId, ["owner"]);
  const admission = membershipAdmission(workspaceId, actor.person.id, ["owner"]);
  admission.sql += " AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND person_id = ? AND status = 'active')";
  admission.params.push(workspaceId, personId);
  return { result: await commit(context, "workspaces.transferOwnership", { workspaceId, personId }, workspaceId, { workspaceId, ownerPersonId: personId }, admission, (operationId) => [
    env.CP_DB.prepare(`UPDATE workspace_members SET role = CASE WHEN person_id = ? THEN 'owner' ELSE 'admin' END
      WHERE workspace_id = ? AND person_id IN (?, ?) AND ${writeGuard}`)
      .bind(personId, workspaceId, actor.person.id, personId, operationId),
  ]) };
}

export async function handleWorkspaceOperation(name, input, context) {
  if (name === "workspaces.create") return createWorkspace(input, context);
  if (name === "workspaces.list") return listWorkspaces(input, context);
  if (name === "workspaces.get") return getWorkspace(input, context);
  if (name === "members.list") return listMembers(input, context);
  if (name === "members.invite") return inviteMember(input, context);
  if (name === "members.accept") return acceptInvitation(input, context);
  if (name === "members.remove") return removeMember(input, context);
  if (name === "members.setRole") return setMemberRole(input, context);
  if (name === "workspaces.transferOwnership") return transferOwnership(input, context);
  return null;
}
