"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, type App, type SecretGrant, type Workspace, type WorkspaceSecret } from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import { useSession, useSubmission } from "./useConsole";
import styles from "./console.module.css";
import local from "./secrets.module.css";

type Directory = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; secrets: WorkspaceSecret[]; apps: App[] };
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; secret: WorkspaceSecret };

function SecretEditor({ workspaceId, secret, apps, onSaved, onClose, onReload }: {
  workspaceId: string; secret?: WorkspaceSecret; apps: App[];
  onSaved: (secret: WorkspaceSecret) => void; onClose: () => void; onReload: () => void;
}) {
  const [name, setName] = useState(secret?.name ?? "");
  const [description, setDescription] = useState(secret?.description ?? "");
  const [value, setValue] = useState("");
  const [grants, setGrants] = useState<SecretGrant[]>(secret?.apps ?? []);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const submission = useSubmission();
  const busy = submission.state.kind === "pending";
  const reference = secret ? { workspaceId, secretId: secret.id, baseRevision: secret.revision } : null;

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { workspaceId, name, description, value };
    const result = await submission.run(JSON.stringify(["details", reference, input]), key => reference
      ? api.updateSecret({ ...reference, name, description }, key)
      : api.createSecret(input, key));
    if (result) { setValue(""); onSaved(result); }
  }
  async function rotate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reference) return;
    const input = { ...reference, value };
    const result = await submission.run(JSON.stringify(["rotate", input]), key => api.rotateSecret(input, key));
    if (result) { setValue(""); onSaved(result); }
  }
  async function saveGrants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reference) return;
    const input = { ...reference, apps: grants };
    const result = await submission.run(JSON.stringify(["grants", input]), key => api.setSecretApps(input, key));
    if (result) onSaved(result);
  }
  async function revoke() {
    if (!reference || !confirmRevoke) return;
    const result = await submission.run(JSON.stringify(["revoke", reference]), key => api.revokeSecret(reference, key));
    if (result) { setValue(""); onSaved(result); }
  }

  return <section className={local.editor} aria-label={secret ? `Manage ${secret.name}` : "Add a secret"}>
    <div className={styles.pageHeader}><h2>{secret ? secret.name : "Add a secret"}</h2><button className={styles.textButton} disabled={busy} onClick={onClose}>Close</button></div>
    {submission.state.kind === "error" && <><ErrorNotice message={submission.state.message} /><button className={styles.textButton} onClick={onReload}>Reload and discard unsaved changes</button></>}
    {secret?.status === "revoked" ? <p className={styles.muted}>Revoked. Atrax erased the stored value and removed its app grants. Revoke the credential with its provider too if it should stop working everywhere.</p> : <>
      <form className={styles.form} onSubmit={saveDetails}>
        <div className={styles.field}><label htmlFor="secret-name">Name</label><input id="secret-name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={busy} placeholder="Email service" /></div>
        <div className={styles.field}><label htmlFor="secret-description">Description</label><input id="secret-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} disabled={busy} placeholder="What this credential is used for" /></div>
        {!secret && <div className={styles.field}><label htmlFor="secret-value">Value</label><input id="secret-value" type="password" value={value} onChange={event => setValue(event.target.value)} required maxLength={16384} autoComplete="new-password" spellCheck={false} disabled={busy} /><small>Encrypted when stored. You cannot reveal this value later.</small></div>}
        <div className={styles.actions}><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : secret ? "Save details" : "Add secret"}</button></div>
      </form>
      {secret && <>
        <form className={`${styles.form} ${local.part}`} onSubmit={saveGrants}>
          <div><h3>App access</h3><p className={styles.muted}>Grant only apps whose backend code and maintainers you trust. Live actions can retrieve the value. Previews cannot.</p></div>
          {apps.length === 0 && <p className={styles.muted}>Create an app to grant it access.</p>}
          {apps.map(app => {
            const grant = grants.find(grant => grant.appId === app.id);
            return <div className={local.grant} key={app.id}>
              <label className={local.choice}><input type="checkbox" checked={Boolean(grant)} disabled={busy} onChange={event => setGrants(event.target.checked ? [...grants, { appId: app.id, bindingName: "API_KEY" }] : grants.filter(item => item.appId !== app.id))} />{app.name}</label>
              {grant && <div className={styles.field}><label htmlFor={`binding-${app.id}`}>Binding name</label><input id={`binding-${app.id}`} value={grant.bindingName} pattern="[A-Z][A-Z0-9_]{0,63}" required maxLength={64} disabled={busy} onChange={event => setGrants(grants.map(item => item.appId === app.id ? { ...item, bindingName: event.target.value } : item))} /><small>Use <code>await ctx.secrets.get(&quot;{grant.bindingName || "API_KEY"}&quot;)</code> in this app.</small></div>}
            </div>;
          })}
          <div className={styles.actions}><button className={styles.secondary} disabled={busy}>Save app access</button></div>
        </form>
        <form className={`${styles.form} ${local.part}`} onSubmit={rotate}>
          <div><h3>Rotate value</h3><p className={styles.muted}>Replace the value for every granted app. The next retrieval uses the new value, with no redeployment.</p></div>
          <div className={styles.field}><label htmlFor="replacement-value">New value</label><input id="replacement-value" type="password" value={value} onChange={event => setValue(event.target.value)} required maxLength={16384} autoComplete="new-password" spellCheck={false} disabled={busy} /></div>
          <div className={styles.actions}><button className={styles.secondary} disabled={busy}>Rotate secret</button></div>
        </form>
        <div className={local.part}><h3>Revoke secret</h3><p className={styles.muted}>Permanently erase Atrax&apos;s stored value and remove all app grants. This does not revoke the credential with its provider or erase copies an app already retrieved.</p><label className={local.choice}><input type="checkbox" checked={confirmRevoke} disabled={busy} onChange={event => setConfirmRevoke(event.target.checked)} />I understand that apps will lose access.</label><button className={styles.danger} disabled={busy || !confirmRevoke} onClick={() => void revoke()}>Revoke secret</button></div>
      </>}
    </>}
  </section>;
}

function SecretsDirectory({ workspace }: { workspace: Workspace }) {
  const [directory, setDirectory] = useState<Directory>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<Editor>({ kind: "closed" });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.listSecrets(workspace.id, controller.signal), api.listApps(workspace.id, controller.signal)]).then(([secrets, apps]) => setDirectory({ kind: "ready", secrets, apps }), (error: unknown) => { if (!controller.signal.aborted) setDirectory({ kind: "error", message: errorMessage(error) }); });
    return () => controller.abort();
  }, [workspace.id, refresh]);
  function saved(secret: WorkspaceSecret) {
    setEditor({ kind: "edit", secret });
    setNotice(secret.status === "revoked" ? "Secret revoked." : "Secret saved.");
    setDirectory(current => current.kind === "ready" ? { ...current, secrets: [secret, ...current.secrets.filter(item => item.id !== secret.id)] } : current);
  }
  function reload() {
    setEditor({ kind: "closed" });
    setNotice("");
    setDirectory({ kind: "loading" });
    setRefresh(value => value + 1);
  }
  return <>
    <header className={styles.pageHeader}><div><h1>Secrets</h1><p className={styles.muted}>Credentials shared with the apps you choose.</p></div>{editor.kind === "closed" && <div className={styles.actions}><button className={styles.secondary} disabled={directory.kind === "loading"} onClick={reload}>Refresh</button><button className={styles.primary} onClick={() => { setNotice(""); setEditor({ kind: "create" }); }}>Add secret</button></div>}</header>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {directory.kind === "loading" && <p role="status">Loading secrets…</p>}
    {directory.kind === "error" && <><ErrorNotice message={directory.message} /><button className={styles.secondary} onClick={() => { setDirectory({ kind: "loading" }); setRefresh(value => value + 1); }}>Try again</button></>}
    {directory.kind === "ready" && <>
      {editor.kind !== "closed" && <SecretEditor key={editor.kind === "create" ? "new" : `${editor.secret.id}:${editor.secret.revision}`} workspaceId={workspace.id} secret={editor.kind === "edit" ? editor.secret : undefined} apps={directory.apps} onSaved={saved} onClose={() => setEditor({ kind: "closed" })} onReload={reload} />}
      {directory.secrets.length === 0 ? <section className={styles.empty}><h2>Keep credentials out of your app code.</h2><p>Add an API key, then grant it to the apps that need it. Company documents and guidance belong in <Link href={`/workspace/library/?workspace=${encodeURIComponent(workspace.id)}`}>Library</Link>.</p></section> : <ul className={local.list}>{directory.secrets.map(secret => <li key={secret.id}><div><strong>{secret.name}</strong>{secret.description && <p>{secret.description}</p>}<small>{secret.status === "revoked" ? "Revoked" : `${secret.apps.length} ${secret.apps.length === 1 ? "app" : "apps"} with access`} · Updated {new Date(secret.updatedAt).toLocaleDateString()}</small></div><button className={styles.secondary} onClick={() => { setNotice(""); setEditor({ kind: "edit", secret }); }}>Manage<span className={local.srOnly}> {secret.name}</span></button></li>)}</ul>}
      <p className={`${styles.muted} ${local.footer}`}>Workspace admins manage Secrets. Agents use the same permissions through the CLI and MCP. <Link href="/docs/secrets/">Read the guide</Link></p>
    </>}
  </>;
}

export function SecretsConsole() {
  const params = useSearchParams();
  const workspaceId = params.get("workspace");
  const { state } = useSession();
  if (state.kind !== "ready") return null;
  const workspace = state.session.workspaces.find(workspace => workspace.id === workspaceId);
  if (!workspace) return <><h1>Workspace unavailable</h1><Link href="/workspaces/">Choose a workspace</Link></>;
  return <>{["owner", "admin"].includes(workspace.role) ? <SecretsDirectory key={workspace.id} workspace={workspace} /> : <><h1>Secrets</h1><p className={styles.muted}>Ask a workspace admin to manage credentials and app grants.</p></>}</>;
}
