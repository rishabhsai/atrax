"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  errorMessage,
  isSignInRequired,
  operation,
  workspaceUrl,
  type Session,
  type Workspace,
} from "./api";
import { AuthFrame, ConsoleFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import consoleStyles from "./console.module.css";
import styles from "./sharing.module.css";

type Role = "owner" | "admin" | "member";
type Member = { personId: string; email: string; role: Role };
type Invitation = { id: string; email: string; role: "admin" | "member"; status: string; expiresAt: number };
type TeamState =
  | { kind: "loading" }
  | { kind: "error"; message: string; forbidden: boolean }
  | { kind: "ready"; members: Member[]; invitations: Invitation[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Atrax returned incomplete team information.", "invalid_response", true);
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new ApiError("Atrax returned incomplete team information.", "invalid_response", true);
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiError("Atrax returned an invalid invitation date.", "invalid_response", true);
  return value;
}
function role(value: unknown): Role {
  if (value !== "owner" && value !== "admin" && value !== "member") throw new ApiError("Atrax returned an invalid team role.", "invalid_response", true);
  return value;
}
function mutableRole(value: unknown): "admin" | "member" {
  if (value !== "admin" && value !== "member") throw new ApiError("Atrax returned an invalid invitation role.", "invalid_response", true);
  return value;
}
function parseTeam(value: unknown): Extract<TeamState, { kind: "ready" }> {
  const result = object(value);
  if (!Array.isArray(result.members) || !Array.isArray(result.invitations))
    throw new ApiError("Atrax returned incomplete team information.", "invalid_response", true);
  return {
    kind: "ready",
    members: result.members.map((value) => {
      const row = object(value);
      return { personId: text(row.personId), email: text(row.email), role: role(row.role) };
    }),
    invitations: result.invitations.map((value) => {
      const row = object(value);
      return { id: text(row.id), email: text(row.email), role: mutableRole(row.role), status: text(row.status), expiresAt: number(row.expiresAt) };
    }),
  };
}
function parseInvitation(value: unknown): Invitation {
  const row = object(object(value).invitation);
  return { id: text(row.id), email: text(row.email), role: mutableRole(row.role), status: text(row.status), expiresAt: number(row.expiresAt) };
}
function key() { return crypto.randomUUID(); }
function roleLabel(value: Role) { return value[0].toUpperCase() + value.slice(1); }
function selectedMutableRole(value: string): "admin" | "member" {
  if (value === "admin" || value === "member") return value;
  throw new ApiError("Choose Admin or Member.", "invalid_input", false);
}

function InviteForm({ workspaceId, onInvited }: { workspaceId: string; onInvited: (invitation: Invitation) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [state, setState] = useState<{ kind: "idle" | "pending" | "success" | "error"; message?: string }>({ kind: "idle" });
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "pending" });
    try {
      const invitation = await operation("members.invite", { workspaceId, email: email.trim(), role }, parseInvitation, { key: key() });
      onInvited(invitation);
      setEmail("");
      setRole("member");
      setState({ kind: "success", message: `Invitation sent to ${invitation.email}.` });
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  return (
    <section className={styles.teamSection} aria-labelledby="invite-heading">
      <div><h2 id="invite-heading">Invite a teammate</h2><p className={consoleStyles.muted}>They will receive an email to join this workspace.</p></div>
      <form className={styles.inviteForm} onSubmit={submit}>
        <div className={consoleStyles.field}><label htmlFor="invite-email">Email</label><input id="invite-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className={styles.selectField}><label htmlFor="invite-role">Role</label><select id="invite-role" value={role} onChange={(event) => setRole(selectedMutableRole(event.target.value))}><option value="member">Member</option><option value="admin">Admin</option></select></div>
        {state.kind === "error" && <p ref={errorRef} tabIndex={-1} className={consoleStyles.error} role="alert">{state.message}</p>}
        {state.kind === "success" && <p className={consoleStyles.success} role="status">{state.message}</p>}
        <div className={consoleStyles.actions}><button className={consoleStyles.primary} type="submit" disabled={state.kind === "pending"}>{state.kind === "pending" ? "Sending…" : "Send invitation"}</button></div>
      </form>
    </section>
  );
}

function MemberRow({ member, workspace, currentPersonId, busy, onRole, onRemove, onTransfer }: {
  member: Member; workspace: Workspace; currentPersonId: string; busy: boolean;
  onRole: (personId: string, role: "admin" | "member") => void;
  onRemove: (member: Member) => void;
  onTransfer: (member: Member) => void;
}) {
  const administer = workspace.role === "owner" || workspace.role === "admin";
  const isSelf = member.personId === currentPersonId;
  return (
    <li className={styles.memberRow}>
      <div><strong>{member.email}</strong>{isSelf && <small>You</small>}</div>
      <span className={styles.roleText}>{roleLabel(member.role)}</span>
      {administer && member.role !== "owner" ? (
        <div className={styles.memberControls}>
          <label><span className={styles.visuallyHidden}>Role for {member.email}</span><select disabled={busy} value={member.role} onChange={(event) => onRole(member.personId, selectedMutableRole(event.target.value))}><option value="member">Member</option><option value="admin">Admin</option></select></label>
          {workspace.role === "owner" && !isSelf && <button className={consoleStyles.textButton} type="button" disabled={busy} onClick={() => onTransfer(member)}>Transfer ownership</button>}
          {!isSelf && <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => onRemove(member)}>Remove</button>}
        </div>
      ) : <span className={styles.noControls}>{member.role === "owner" ? "Workspace owner" : ""}</span>}
    </li>
  );
}

function MemberConfirmation({
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: {
  confirmation: { action: "remove" | "transfer"; member: Member };
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={styles.confirmation}
      aria-labelledby="team-confirm-heading"
      aria-describedby="team-confirm-copy"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="team-confirm-heading">
        {confirmation.action === "remove"
          ? `Remove ${confirmation.member.email}?`
          : `Transfer ownership to ${confirmation.member.email}?`}
      </h2>
      <p id="team-confirm-copy">
        {confirmation.action === "remove"
          ? "They will immediately lose access to this workspace and its apps."
          : "You will become an admin. The new owner will control ownership transfers."}
      </p>
      <div className={consoleStyles.actions}>
        <button className={styles.dangerButton} type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmation.action === "remove" ? "Remove teammate" : "Transfer ownership"}
        </button>
        <button ref={cancelRef} className={consoleStyles.secondary} type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </dialog>
  );
}

function TeamContent({ session, workspace }: { session: Session; workspace: Workspace }) {
  const [state, setState] = useState<TeamState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busyPerson, setBusyPerson] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: "remove" | "transfer"; member: Member } | null>(null);
  const administer = workspace.role === "owner" || workspace.role === "admin";

  useEffect(() => {
    const controller = new AbortController();
    operation("members.list", { workspaceId: workspace.id }, parseTeam, { signal: controller.signal }).then(
      setState,
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", message: errorMessage(error), forbidden: error instanceof ApiError && error.code === "forbidden" });
      },
    );
    return () => controller.abort();
  }, [workspace.id, attempt]);

  async function changeRole(personId: string, nextRole: "admin" | "member") {
    if (state.kind !== "ready") return;
    setBusyPerson(personId); setNotice(null);
    try {
      await operation("members.setRole", { workspaceId: workspace.id, personId, role: nextRole }, () => undefined, { key: key() });
      setState({ ...state, members: state.members.map((member) => member.personId === personId ? { ...member, role: nextRole } : member) });
      setNotice({ kind: "success", message: "Team role updated." });
    } catch (error) { setNotice({ kind: "error", message: errorMessage(error) }); }
    finally { setBusyPerson(null); }
  }

  async function confirmMemberAction() {
    if (!confirmation || state.kind !== "ready") return;
    const { action, member } = confirmation;
    setBusyPerson(member.personId); setNotice(null);
    try {
      await operation(action === "remove" ? "members.remove" : "workspaces.transferOwnership", { workspaceId: workspace.id, personId: member.personId }, () => undefined, { key: key() });
      if (action === "remove") {
        setState({ ...state, members: state.members.filter((item) => item.personId !== member.personId) });
        setNotice({ kind: "success", message: `${member.email} was removed from the workspace.` });
      } else {
        setState({ ...state, members: state.members.map((item) => item.personId === member.personId ? { ...item, role: "owner" } : item.personId === session.person.id ? { ...item, role: "admin" } : item) });
        setNotice({ kind: "success", message: `Ownership transferred to ${member.email}. Refreshing your workspace permissions…` });
        window.location.reload();
      }
      setConfirmation(null);
    } catch (error) { setNotice({ kind: "error", message: errorMessage(error) }); }
    finally { setBusyPerson(null); }
  }

  return (
    <ConsoleFrame session={session} workspace={workspace} active="team">
      <nav className={consoleStyles.breadcrumb} aria-label="Breadcrumb"><Link href={workspaceUrl(workspace.id)}>Apps</Link><span aria-hidden="true">/</span><span>Team</span></nav>
      <header className={consoleStyles.pageHeader}><div><h1>Team</h1><p>People who can work in {workspace.name}.</p></div></header>
      {state.kind === "loading" && <><div className={consoleStyles.skeleton} aria-hidden="true" /><p role="status">Loading team…</p></>}
      {state.kind === "error" && <section className={styles.teamSection}><h2>{state.forbidden ? "Team access unavailable" : "Couldn't load the team"}</h2><ErrorNotice message={state.message} />{!state.forbidden && <button className={consoleStyles.secondary} type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((value) => value + 1); }}>Try again</button>}</section>}
      {state.kind === "ready" && (
        <>
          {notice?.kind === "error" && <ErrorNotice message={notice.message} />}
          {notice?.kind === "success" && <p className={consoleStyles.success} role="status">{notice.message}</p>}
          {confirmation && <MemberConfirmation confirmation={confirmation} busy={busyPerson !== null} onConfirm={confirmMemberAction} onCancel={() => setConfirmation(null)} />}
          <section className={styles.teamSection} aria-labelledby="members-heading"><div className={styles.teamHeading}><div><h2 id="members-heading">Members</h2><p className={consoleStyles.muted}>{state.members.length} {state.members.length === 1 ? "person" : "people"}</p></div></div>
            <ul className={styles.memberList}>{state.members.map((member) => <MemberRow key={member.personId} member={member} workspace={workspace} currentPersonId={session.person.id} busy={busyPerson === member.personId} onRole={changeRole} onRemove={(member) => setConfirmation({ action: "remove", member })} onTransfer={(member) => setConfirmation({ action: "transfer", member })} />)}</ul>
          </section>
          {administer && <InviteForm workspaceId={workspace.id} onInvited={(invitation) => setState((current) => current.kind === "ready" ? { ...current, invitations: [invitation, ...current.invitations.filter((item) => item.email !== invitation.email)] } : current)} />}
          {administer && <section className={styles.teamSection} aria-labelledby="invitations-heading"><div><h2 id="invitations-heading">Invitations</h2><p className={consoleStyles.muted}>Pending and recent invitations for this workspace.</p></div>{state.invitations.length ? <ul className={styles.invitationList}>{state.invitations.map((invitation) => <li key={invitation.id}><div><strong>{invitation.email}</strong><small>Invited as {roleLabel(invitation.role)} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</small></div><span className={consoleStyles.status}>{invitation.status}</span></li>)}</ul> : <p className={styles.emptyState}>No invitations have been sent.</p>}</section>}
        </>
      )}
    </ConsoleFrame>
  );
}

export function TeamConsole() {
  const params = useSearchParams();
  const workspaceId = params.get("workspace");
  const { state, retry } = useSession();
  const returnTo = workspaceId ? `/workspace/team/?workspace=${encodeURIComponent(workspaceId)}` : "/workspaces/";
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error") return <AuthFrame><h1>{isSignInRequired(state.error) ? "Sign in to manage your team" : "Couldn't load your workspaces"}</h1>{isSignInRequired(state.error) ? <><p className={consoleStyles.muted}>Use your email to return to your workspace.</p><Link className={consoleStyles.primary} href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}>Continue with email</Link></> : <><ErrorNotice message={errorMessage(state.error)} /><button className={consoleStyles.secondary} onClick={retry}>Try again</button></>}</AuthFrame>;
  if (!workspaceId) return <AuthFrame><h1>Choose a workspace</h1><p className={consoleStyles.muted}>Open Team from a workspace to manage its members.</p><Link className={consoleStyles.primary} href="/workspaces/">Your workspaces</Link></AuthFrame>;
  const workspace = state.session.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <ConsoleFrame session={state.session}><h1>Workspace unavailable</h1><p className={consoleStyles.muted}>This workspace isn&apos;t available to you.</p><Link className={consoleStyles.primary} href="/workspaces/">Choose a workspace</Link></ConsoleFrame>;
  return <TeamContent key={workspace.id} session={state.session} workspace={workspace} />;
}
