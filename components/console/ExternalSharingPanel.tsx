"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage, operation, type ExternalGuestAccess, type PublicPublication } from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import consoleStyles from "./console.module.css";
import styles from "./external-sharing.module.css";

type Props = {
  appId: string;
  appName: string;
  appUrl: string;
  activeReleaseId: string | null;
  role: string | undefined;
  onChange?: () => void;
};

const parseRecord = (value: unknown) => value as Record<string, unknown>;
const error = (reason: unknown) => reason instanceof ApiError ? errorMessage(reason) : "Atrax couldn’t save that change. Please try again.";
const isAdmin = (role: string | undefined) => role === "owner" || role === "admin";

function actionNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((name) => typeof name !== "string"))
    throw new ApiError("Atrax returned incomplete guest access information.", "invalid_response", true);
  return value;
}
function asGuests(value: unknown): ExternalGuestAccess {
  const result = parseRecord(value);
  if (!Array.isArray(result.guests) || !Array.isArray(result.invitations))
    throw new ApiError("Atrax returned incomplete guest access information.", "invalid_response", true);
  return {
    guests: result.guests as ExternalGuestAccess["guests"],
    invitations: result.invitations as ExternalGuestAccess["invitations"],
    grantableActionNames: actionNames(result.grantableActionNames),
  };
}

function asPublication(value: unknown): PublicPublication {
  const publication = parseRecord(parseRecord(value).publication);
  const publicationRevision = publication.publicationRevision;
  if (typeof publication.public !== "boolean" || typeof publicationRevision !== "number" || !Number.isInteger(publicationRevision))
    throw new ApiError("Atrax returned incomplete public web information.", "invalid_response", true);
  if (publication.activeReleaseId !== null && typeof publication.activeReleaseId !== "string")
    throw new ApiError("Atrax returned incomplete public web information.", "invalid_response", true);
  return { public: publication.public, publicationRevision, activeReleaseId: publication.activeReleaseId };
}

export function ExternalSharingPanel({ appId, appName, appUrl, activeReleaseId, role, onChange }: Props) {
  const canManage = isAdmin(role);
  const [guests, setGuests] = useState<ExternalGuestAccess | null>(null);
  const [publication, setPublication] = useState<PublicPublication | null>(null);
  const [email, setEmail] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const inviteKey = useRef<string | null>(null);

  async function refresh() {
    if (!canManage) return;
    setFailure(null);
    try {
      const [nextGuests, nextPublication] = await Promise.all([
        operation("apps.guests.list", { appId }, asGuests),
        operation("apps.public.get", { appId }, asPublication),
      ]);
      setGuests(nextGuests);
      setPublication(nextPublication);
    } catch (reason) {
      setFailure(error(reason));
    }
  }
  useEffect(() => {
    if (!canManage) return;
    let active = true;
    Promise.all([
      operation("apps.guests.list", { appId }, asGuests),
      operation("apps.public.get", { appId }, asPublication),
    ]).then(([nextGuests, nextPublication]) => {
      if (active) { setGuests(nextGuests); setPublication(nextPublication); }
    }, (reason: unknown) => { if (active) setFailure(error(reason)); });
    return () => { active = false; };
  }, [appId, canManage]);
  if (!canManage) return null;

  function toggleAction(name: string) {
    setSelectedActions((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("invite"); setFailure(null); inviteKey.current ??= crypto.randomUUID();
    try {
      await operation("apps.guests.invite", { appId, email, actionNames: selectedActions }, parseRecord, { key: inviteKey.current });
      setEmail(""); setSelectedActions([]); inviteKey.current = null;
      await refresh();
    } catch (reason) { setFailure(error(reason)); }
    finally { setPending(null); }
  }
  async function revoke(personId: string) {
    setPending(`revoke:${personId}`); setFailure(null);
    try { await operation("apps.guests.revoke", { appId, personId }, parseRecord, { key: crypto.randomUUID() }); await refresh(); onChange?.(); }
    catch (reason) { setFailure(error(reason)); }
    finally { setPending(null); }
  }
  async function changePublication(nextPublic: boolean) {
    if (!publication || confirm !== appName) return;
    setPending(nextPublic ? "publish" : "unpublish"); setFailure(null);
    try {
      const result = await operation(nextPublic ? "apps.public.publish" : "apps.public.unpublish", nextPublic
        ? { appId, releaseId: activeReleaseId, publicationRevision: publication.publicationRevision, confirmation: "publish" }
        : { appId, publicationRevision: publication.publicationRevision, confirmation: "unpublish" }, parseRecord, { key: crypto.randomUUID() });
      setPublication(asPublication(result)); setConfirm(""); onChange?.();
    } catch (reason) { setFailure(error(reason)); }
    finally { setPending(null); }
  }

  return <section className={styles.panel} aria-labelledby="external-sharing-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>External access</p><h2 id="external-sharing-title">Guests and public web</h2></div><button className={consoleStyles.textButton} onClick={() => void refresh()} disabled={pending !== null}>Refresh</button></header>
    <p className={styles.copy}>Guests are verified people with access to this app only. Public web serves static pages at <a href={appUrl}>{appUrl}</a>; app access, actions, and Library keep their current rules.</p>
    {failure && <ErrorNotice message={failure} />}
    <div className={styles.columns}>
      <div className={styles.card}><h3>Invite a guest</h3><form className={styles.form} onSubmit={invite}><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="person@example.com" /></label><fieldset><legend>Actions they can use</legend>{guests?.grantableActionNames.length ? guests.grantableActionNames.map((name) => <label className={styles.check} key={name}><input type="checkbox" checked={selectedActions.includes(name)} onChange={() => toggleAction(name)} /><span><code>{name}</code></span></label>) : <p className={consoleStyles.muted}>This release has no actions. The guest can view the app only.</p>}</fieldset><button className={consoleStyles.primary} disabled={pending !== null}>{pending === "invite" ? "Sending invitation…" : "Send guest invitation"}</button></form></div>
      <div className={styles.card}><h3>Public web</h3>{publication ? <><p className={styles.status}>{publication.public ? "Public web is on" : "Public web is off"}</p><p className={styles.copy}>{publication.public ? "Anyone can load the static web pages. App access, actions, and Library still require their current permissions." : "Static pages follow the app’s current access rules. Publishing does not change who can open the app or use its actions."}</p>{!activeReleaseId && <p className={styles.notice}>Deploy an active release before publishing this app.</p>}<label>Type <strong>{appName}</strong> to {publication.public ? "unpublish" : "publish"}<input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={appName} /></label><button className={publication.public ? consoleStyles.secondary : consoleStyles.primary} disabled={pending !== null || confirm !== appName || (!publication.public && !activeReleaseId)} onClick={() => void changePublication(!publication.public)}>{pending === "publish" ? "Publishing…" : pending === "unpublish" ? "Removing public access…" : publication.public ? "Unpublish web" : "Publish web"}</button></> : <p className={consoleStyles.muted}>Loading public web status…</p>}</div>
    </div>
    <div className={styles.card}><h3>Current guests</h3>{guests ? <>{guests.guests.length ? <ul className={styles.guestList}>{guests.guests.map((guest) => <li key={guest.personId}><div><strong>{guest.email}</strong><small>{guest.actionNames.length ? guest.actionNames.join(", ") : "View only"}</small></div><button className={consoleStyles.textButton} disabled={pending === `revoke:${guest.personId}`} onClick={() => void revoke(guest.personId)}>{pending === `revoke:${guest.personId}` ? "Revoking…" : "Revoke"}</button></li>)}</ul> : <p className={consoleStyles.muted}>No guests have accepted an invitation.</p>}{guests.invitations.filter((invite) => invite.status === "pending").length > 0 && <p className={styles.pending}>Pending: {guests.invitations.filter((invite) => invite.status === "pending").map((invite) => invite.email).join(", ")}</p>}</> : <p className={consoleStyles.muted}>Loading guest access…</p>}</div>
  </section>;
}
