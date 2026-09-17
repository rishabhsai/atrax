"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ApiError,
  api,
  audienceLabel,
  errorMessage,
  isSignInRequired,
  type LibraryDetail,
  type LibraryRevision,
  type LibrarySource,
  type LibrarySummary,
  type Session,
  type Workspace,
  type WorkspaceMember,
} from "./api";
import { AuthFrame, ConsoleFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import styles from "./console.module.css";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "error"; message: string };

type SourceDraft = LibrarySource & { key: string };

function libraryUrl(workspaceId: string, itemId?: string, revisionId?: string) {
  const query = new URLSearchParams({ workspace: workspaceId });
  if (itemId) query.set("item", itemId);
  if (revisionId) query.set("revision", revisionId);
  return `/workspace/library/?${query}`;
}

function changedUrl(values: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}`;
}

function dateTime(value: number) {
  return new Date(value).toLocaleString();
}

function sourceDrafts(sources: LibrarySource[]) {
  return sources.map((source) => ({ ...source, key: crypto.randomUUID() }));
}

function sourceInput(sources: SourceDraft[]) {
  return sources.map(({ itemId, revisionId }) => ({ itemId: itemId.trim(), revisionId: revisionId.trim() }));
}

function contentTypeFor(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "txt" ? "text/plain"
    : extension === "md" || extension === "markdown" ? "text/markdown"
      : extension === "csv" ? "text/csv"
        : extension === "json" ? "application/json"
          : extension === "pdf" ? "application/pdf"
            : "";
}

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const block = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += block) binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  return btoa(binary);
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function SourcesEditor({
  sources,
  onChange,
}: {
  sources: SourceDraft[];
  onChange: (sources: SourceDraft[]) => void;
}) {
  function update(key: string, field: "itemId" | "revisionId", value: string) {
    onChange(sources.map((source) => source.key === key ? { ...source, [field]: value } : source));
  }
  return (
    <fieldset className={styles.sourceFields}>
      <legend>Source revisions</legend>
      <p className={styles.small}>
        Cite an exact Library item and revision when this guidance is derived from it. Everyone who reads this entry must also be able to read every cited source.
      </p>
      {sources.map((source, index) => (
        <div className={styles.sourceRow} key={source.key}>
          <label>
            <span className={styles.small}>Item ID</span>
            <input value={source.itemId} onChange={(event) => update(source.key, "itemId", event.target.value)} />
          </label>
          <label>
            <span className={styles.small}>Revision ID</span>
            <input value={source.revisionId} onChange={(event) => update(source.key, "revisionId", event.target.value)} />
          </label>
          <button className={styles.textButton} type="button" onClick={() => onChange(sources.filter((item) => item.key !== source.key))}>
            Remove source {index + 1}
          </button>
        </div>
      ))}
      <button className={styles.secondary} type="button" onClick={() => onChange([...sources, { itemId: "", revisionId: "", key: crypto.randomUUID() }])}>
        Add source revision
      </button>
    </fieldset>
  );
}

function EntryForm({
  workspaceId,
  detail,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  detail?: LibraryDetail;
  onSaved: (detail: LibraryDetail) => void;
  onCancel: () => void;
}) {
  const existing = detail?.revision;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [reason, setReason] = useState(existing ? "" : "Created");
  const [sources, setSources] = useState<SourceDraft[]>(() => sourceDrafts(existing?.sourceRevisions ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictRevisionId, setConflictRevisionId] = useState<string | null>(null);
  const [conflicting, setConflicting] = useState<LibraryDetail | null>(null);
  const key = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setConflictRevisionId(null);
    setConflicting(null);
    key.current ??= crypto.randomUUID();
    try {
      const cited = sourceInput(sources);
      if (cited.some((source) => !source.itemId || !source.revisionId)) {
        throw new Error("Each source needs both an item ID and a revision ID.");
      }
      const saved = existing
        ? await api.reviseEntry({ workspaceId, itemId: detail.item.id, baseRevisionId: detail.item.currentRevisionId, title: title.trim(), text: text.trim(), reason: reason.trim(), sourceRevisions: cited }, key.current)
        : await api.createEntry({ workspaceId, title: title.trim(), text: text.trim(), sourceRevisions: cited }, key.current);
      key.current = null;
      onSaved(saved);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "revision_conflict") {
        const currentRevisionId = failure.details?.currentRevisionId;
        if (typeof currentRevisionId === "string" && detail) {
          setConflictRevisionId(currentRevisionId);
          api.getLibrary(workspaceId, detail.item.id, currentRevisionId).then(
            setConflicting,
            () => undefined,
          );
        }
      }
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.editor} aria-labelledby={existing ? "correct-entry" : "add-entry"}>
      <h2 id={existing ? "correct-entry" : "add-entry"}>{existing ? "Correct this entry" : "Add an entry"}</h2>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="library-title">Title</label>
          <input id="library-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="library-content">Content</label>
          <textarea id="library-content" required maxLength={40000} value={text} onChange={(event) => setText(event.target.value)} />
          <small>{existing ? "Saving replaces the current guidance and keeps the previous version in History." : "Write the guidance your team should use."}</small>
        </div>
        {existing && (
          <div className={styles.field}>
            <label htmlFor="library-reason">Correction note</label>
            <input id="library-reason" required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        )}
        <SourcesEditor sources={sources} onChange={setSources} />
        {error && <ErrorNotice message={error} />}
        {conflictRevisionId && (
          <div className={styles.conflict}>
            <p>Your draft is still here. This entry now has a newer revision.</p>
            {conflicting ? <><strong>Current version {conflicting.revision.number}</strong><p className={styles.conflictContent}>{conflicting.revision.text}</p></> : <Link href={libraryUrl(workspaceId, detail?.item.id, conflictRevisionId)}>Read the current revision</Link>}
          </div>
        )}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={saving}>
            {saving ? "Saving…" : existing ? "Save correction" : "Save entry"}
          </button>
          <button className={styles.secondary} type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function FileUploadForm({
  workspaceId,
  detail,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  detail?: LibraryDetail;
  onSaved: (detail: LibraryDetail) => void;
  onCancel: () => void;
}) {
  const [capabilities, setCapabilities] = useState<LoadState<{ maxBytes: number; searchableTextMaxBytes: number; acceptedContentTypes: string[] }>>({ kind: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.fileCapabilities(workspaceId, controller.signal).then(
      (value) => setCapabilities({ kind: "ready", value }),
      (failure: unknown) => !controller.signal.aborted && setCapabilities({ kind: "error", message: errorMessage(failure) }),
    );
    return () => controller.abort();
  }, [workspaceId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || capabilities.kind !== "ready" || saving) return;
    const contentType = contentTypeFor(file);
    if (!contentType || !capabilities.value.acceptedContentTypes.includes(contentType)) {
      setError("This file type is not supported by Library.");
      return;
    }
    if (file.size > capabilities.value.maxBytes) {
      setError(`This file is larger than the ${formatBytes(capabilities.value.maxBytes)} Library limit.`);
      return;
    }
    setSaving(true);
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      const contentBase64 = await fileBase64(file);
      const saved = detail
        ? await api.replaceFile({ workspaceId, itemId: detail.item.id, baseRevisionId: detail.item.currentRevisionId, filename: file.name, contentType, contentBase64, ...(title.trim() ? { title: title.trim() } : {}), reason: reason.trim() }, key.current)
        : await api.uploadFile({ workspaceId, filename: file.name, contentType, contentBase64, ...(title.trim() ? { title: title.trim() } : {}) }, key.current);
      key.current = null;
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  const accepted = capabilities.kind === "ready" ? capabilities.value.acceptedContentTypes : [];
  return <section className={styles.editor} aria-labelledby="upload-file"><h2 id="upload-file">{detail ? "Replace file" : "Upload files"}</h2><form className={styles.form} onSubmit={submit}>
    <div className={styles.field}>
      <label htmlFor="library-file">File</label>
      <input id="library-file" type="file" required accept={accepted.join(",")} disabled={capabilities.kind !== "ready" || saving} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} />
      {capabilities.kind === "loading" && <small>Checking supported file types…</small>}
      {capabilities.kind === "ready" && <small>Supported: {accepted.join(", ")}. Maximum {formatBytes(capabilities.value.maxBytes)}. Text is searchable only when the file is a supported UTF-8 text file up to {formatBytes(capabilities.value.searchableTextMaxBytes)}.</small>}
      {file && <small>Selected {file.name} ({formatBytes(file.size)}).</small>}
    </div>
    <div className={styles.field}><label htmlFor="library-file-title">Library title</label><input id="library-file-title" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /><small>Leave blank to use the filename.</small></div>
    {detail && <div className={styles.field}><label htmlFor="library-file-reason">Replacement note</label><input id="library-file-reason" required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
    {capabilities.kind === "error" && <ErrorNotice message={capabilities.message} />}
    {error && <ErrorNotice message={error} />}
    <div className={styles.actions}><button className={styles.primary} type="submit" disabled={saving || capabilities.kind !== "ready" || !file}>{saving ? "Uploading…" : detail ? "Replace file" : "Upload file"}</button><button className={styles.secondary} type="button" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form></section>;
}

function AccessEditor({
  workspaceId,
  detail,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  detail: LibraryDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [members, setMembers] = useState<LoadState<WorkspaceMember[]>>({ kind: "loading" });
  const [audience, setAudience] = useState<"workspace" | "selected">(detail.item.audience === "selected" ? "selected" : "workspace");
  const [personIds, setPersonIds] = useState(detail.item.personIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.listMembers(workspaceId, controller.signal).then(
      (value) => setMembers({ kind: "ready", value }),
      (failure: unknown) => !controller.signal.aborted && setMembers({ kind: "error", message: errorMessage(failure) }),
    );
    return () => controller.abort();
  }, [workspaceId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      await api.libraryAccess({ workspaceId, itemId: detail.item.id, audience, personIds: audience === "selected" ? personIds : [] }, key.current);
      key.current = null;
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className={styles.editor} aria-labelledby="library-access">
      <h2 id="library-access">Library access</h2>
      <p className={styles.muted}>Source permissions still apply. A person must be allowed to read every cited source before they can read derived guidance.</p>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.choiceGroup}>
          <label><input type="radio" name="audience" checked={audience === "workspace"} onChange={() => setAudience("workspace")} /> Everyone in the workspace</label>
          <label><input type="radio" name="audience" checked={audience === "selected"} onChange={() => setAudience("selected")} /> Selected people</label>
        </div>
        {audience === "selected" && (
          <div className={styles.memberChoices}>
            {members.kind === "loading" && <p role="status" className={styles.muted}>Loading team members…</p>}
            {members.kind === "error" && <ErrorNotice message={members.message} />}
            {members.kind === "ready" && members.value.map((member) => (
              <label key={member.personId}>
                <input type="checkbox" checked={personIds.includes(member.personId)} onChange={(event) => setPersonIds(event.target.checked ? [...personIds, member.personId] : personIds.filter((id) => id !== member.personId))} />
                {member.email} <span className={styles.small}>({member.role})</span>
              </label>
            ))}
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={saving || members.kind === "loading"}>{saving ? "Saving…" : "Save access"}</button>
          <button className={styles.secondary} type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function Detail({
  workspace,
  session,
  itemId,
  revisionId,
}: {
  workspace: Workspace;
  session: Session;
  itemId: string;
  revisionId: string | null;
}) {
  const [state, setState] = useState<LoadState<LibraryDetail>>({ kind: "loading" });
  const [history, setHistory] = useState<LoadState<LibraryRevision[]>>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [access, setAccess] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const archiveKey = useRef<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    api.getLibrary(workspace.id, itemId, revisionId ?? undefined, controller.signal).then(
      (value) => setState({ kind: "ready", value }),
      (failure: unknown) => !controller.signal.aborted && setState({ kind: "error", message: errorMessage(failure) }),
    );
    api.libraryHistory(workspace.id, itemId, controller.signal).then(
      (value) => setHistory({ kind: "ready", value }),
      (failure: unknown) => !controller.signal.aborted && setHistory({ kind: "error", message: errorMessage(failure) }),
    );
    return () => controller.abort();
  }, [workspace.id, itemId, revisionId, attempt]);
  if (state.kind === "loading") return <><div className={styles.skeleton} aria-hidden="true" /><p role="status">Loading Library item…</p></>;
  if (state.kind === "error") return <><ErrorNotice message={state.message} /><div className={styles.inlineNote}><button className={styles.secondary} onClick={() => setAttempt((value) => value + 1)}>Try again</button></div></>;
  const detail = state.value;
  const item = detail.item;
  const revision = detail.revision;
  const canManage = item.createdBy === session.person.id || ["owner", "admin"].includes(workspace.role);
  const current = item.currentRevisionId === revision.id;
  async function archive() {
    if (!window.confirm(`Archive “${item.title}”? It will disappear from active Library browsing and search, while its history remains available.`)) return;
    setArchiving(true);
    setError(null);
    archiveKey.current ??= crypto.randomUUID();
    try {
      await api.libraryArchive(workspace.id, item.id, archiveKey.current);
      router.push(libraryUrl(workspace.id));
    } catch (failure) {
      setError(errorMessage(failure));
      setArchiving(false);
    }
  }
  async function download() {
    setError(null);
    try {
      const downloaded = await api.downloadFile(workspace.id, item.id, revision.id);
      const binary = atob(downloaded.contentBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: downloaded.file.contentType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = downloaded.file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  if (editing) return <EntryForm key={revision.id} workspaceId={workspace.id} detail={detail} onSaved={(saved) => { setEditing(false); router.push(libraryUrl(workspace.id, saved.item.id, saved.revision.id)); }} onCancel={() => setEditing(false)} />;
  if (replacing) return <FileUploadForm key={revision.id} workspaceId={workspace.id} detail={detail} onSaved={(saved) => { setReplacing(false); router.push(libraryUrl(workspace.id, saved.item.id, saved.revision.id)); }} onCancel={() => setReplacing(false)} />;
  if (access) return <AccessEditor workspaceId={workspace.id} detail={detail} onSaved={() => { setAccess(false); setAttempt((value) => value + 1); }} onCancel={() => setAccess(false)} />;
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href={libraryUrl(workspace.id)}>Library</Link><span aria-hidden="true">/</span><span>{item.title}</span></nav>
      <header className={styles.pageHeader}>
        <div>
          <h1>{item.title}</h1>
          <p>{item.kind === "knowledge" ? "Knowledge entry" : item.kind} · {audienceLabel(item.audience)} · updated {dateTime(item.updatedAt)}</p>
        </div>
        <div className={styles.actions}>
          {item.kind === "knowledge" && current && item.status === "active" && <button className={styles.primary} onClick={() => setEditing(true)}>Edit entry</button>}
          {item.kind === "file" && revision.file && <button className={styles.secondary} onClick={download}>Download original</button>}
          {item.kind === "file" && current && item.status === "active" && <button className={styles.primary} onClick={() => setReplacing(true)}>Replace file</button>}
          {canManage && item.status === "active" && <button className={styles.secondary} onClick={() => setAccess(true)}>Manage access</button>}
          {canManage && item.status === "active" && <button className={styles.danger} onClick={archive} disabled={archiving}>{archiving ? "Archiving…" : "Archive"}</button>}
        </div>
      </header>
      {error && <ErrorNotice message={error} />}
      {item.status !== "active" && <p className={styles.notice}>Archived items are retained for their history and are no longer included in active Library search.</p>}
      {revision.id !== item.currentRevisionId && <p className={styles.notice}>You are reading revision {revision.number}. <Link href={libraryUrl(workspace.id, item.id)}>Read the active revision</Link>.</p>}
      <dl className={styles.libraryMeta}>
        <div><dt>Revision</dt><dd>Version {revision.number}{current ? " (active)" : ""}</dd></div>
        <div><dt>Contributed by</dt><dd>{revision.author.email}{revision.author.agentLabel ? ` via ${revision.author.agentLabel}` : ""}</dd></div>
        <div><dt>Updated</dt><dd><time dateTime={new Date(revision.createdAt).toISOString()}>{dateTime(revision.createdAt)}</time></dd></div>
        <div><dt>Search status</dt><dd>{revision.indexingStatus === "ready" ? "Searchable" : revision.indexingStatus}</dd></div>
        {revision.file && <><div><dt>Original file</dt><dd>{revision.file.filename}</dd></div><div><dt>File size</dt><dd>{formatBytes(revision.file.byteSize)}</dd></div></>}
      </dl>
      {item.kind === "knowledge" || revision.text ? <section className={styles.libraryContent} aria-labelledby="library-content-heading"><h2 id="library-content-heading">Content</h2><div>{revision.text}</div></section> : <section className={styles.libraryContent} aria-labelledby="library-content-heading"><h2 id="library-content-heading">Content</h2><p className={styles.muted}>This file is stored for download and is not searchable.</p></section>}
      {revision.sourceRevisions.length > 0 && <section className={styles.librarySources} aria-labelledby="library-sources-heading"><h2 id="library-sources-heading">Sources</h2><p className={styles.muted}>This entry is derived from these exact revisions. Their current access rules also determine who can read this entry.</p><ul>{revision.sourceRevisions.map((source) => <li key={`${source.itemId}:${source.revisionId}`}><Link href={libraryUrl(workspace.id, source.itemId, source.revisionId)}>View cited revision <code>{source.revisionId}</code></Link></li>)}</ul></section>}
      <section className={styles.libraryHistory} aria-labelledby="library-history-heading"><h2 id="library-history-heading">History</h2>
        {history.kind === "loading" && <p role="status" className={styles.muted}>Loading history…</p>}
        {history.kind === "error" && <ErrorNotice message={history.message} />}
        {history.kind === "ready" && <ol className={styles.revisionList}>{history.value.map((entry) => <li key={entry.id}><Link href={libraryUrl(workspace.id, item.id, entry.id)} aria-current={entry.id === revision.id ? "page" : undefined}>Version {entry.number}</Link><span>{entry.author.email}{entry.author.agentLabel ? ` via ${entry.author.agentLabel}` : ""} · {dateTime(entry.createdAt)}</span><small>{entry.reason}</small></li>)}</ol>}
      </section>
      <div className={styles.inlineNote}><Link className={styles.secondary} href={libraryUrl(workspace.id)}>Back to Library</Link></div>
    </>
  );
}

function Listing({ workspace }: { workspace: Workspace }) {
  const params = useSearchParams();
  const router = useRouter();
  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<"all" | "knowledge" | "file">("all");
  const [state, setState] = useState<LoadState<LibrarySummary[]>>({ kind: "loading" });
  const [adding, setAdding] = useState<"entry" | "file" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.listLibrary(workspace.id, query.trim(), controller.signal).then(
      (value) => setState({ kind: "ready", value }),
      (failure: unknown) => !controller.signal.aborted && setState({ kind: "error", message: errorMessage(failure) }),
    );
    return () => controller.abort();
  }, [workspace.id, query, attempt]);
  function updateQuery(value: string) {
    setQuery(value);
    window.history.replaceState(window.history.state, "", changedUrl({ q: value || null }));
  }
  if (adding === "entry") return <EntryForm workspaceId={workspace.id} onSaved={(detail) => router.push(libraryUrl(workspace.id, detail.item.id, detail.revision.id))} onCancel={() => setAdding(null)} />;
  if (adding === "file") return <FileUploadForm workspaceId={workspace.id} onSaved={(detail) => router.push(libraryUrl(workspace.id, detail.item.id, detail.revision.id))} onCancel={() => setAdding(null)} />;
  const items = state.kind === "ready" ? state.value.filter((item) => filter === "all" || item.kind === filter) : [];
  return (
    <>
      <header className={styles.pageHeader}>
        <div><h1>Library</h1><p>Company files and guidance for your team.</p></div>
        <div className={styles.actions}><button className={styles.secondary} onClick={() => setAdding("entry")}>Add entry</button><button className={styles.primary} onClick={() => setAdding("file")}>Upload files</button></div>
      </header>
      <div className={styles.libraryToolbar}>
        <div className={`${styles.field} ${styles.search}`}><label htmlFor="library-search">Search company knowledge</label><input id="library-search" type="search" value={query} onChange={(event) => updateQuery(event.target.value)} /></div>
        <div className={styles.filterGroup} aria-label="Library type"><button className={filter === "all" ? styles.filterActive : styles.secondary} onClick={() => setFilter("all")}>All</button><button className={filter === "knowledge" ? styles.filterActive : styles.secondary} onClick={() => setFilter("knowledge")}>Entries</button><button className={filter === "file" ? styles.filterActive : styles.secondary} onClick={() => setFilter("file")}>Files</button></div>
      </div>
      {state.kind === "loading" && <><div className={styles.skeleton} aria-hidden="true" /><p role="status">Loading Library…</p></>}
      {state.kind === "error" && <><ErrorNotice message={state.message} /><div className={styles.inlineNote}><button className={styles.secondary} onClick={() => setAttempt((value) => value + 1)}>Try again</button></div></>}
      {state.kind === "ready" && (items.length ? <ul className={styles.libraryList}>{items.map((item) => <li key={item.id}><Link href={libraryUrl(workspace.id, item.id, item.revisionId)}><strong>{item.title}</strong><span>{item.kind === "knowledge" ? "Entry" : "File"}{item.file ? ` · ${item.file.filename}` : ""} · {audienceLabel(item.audience)}{item.sourceRevisions.length ? " · Derived from sources" : ""}</span>{item.snippet && <small>{item.snippet}</small>}<small>Updated {dateTime(item.updatedAt)} · {item.indexingStatus === "ready" ? "Searchable" : "Stored, not searchable"}</small></Link></li>)}</ul> : <section className={styles.empty}><h2>{query ? `No results for “${query}”.` : "Add the knowledge your team works from."}</h2><p>{query ? "Try a different search, or clear the search to browse all items." : "Upload a policy or reference document, or add written guidance."}</p>{query ? <button className={styles.secondary} onClick={() => updateQuery("")}>Clear search</button> : <div className={styles.actions}><button className={styles.secondary} onClick={() => setAdding("entry")}>Add an entry</button><button className={styles.primary} onClick={() => setAdding("file")}>Upload files</button></div>}</section>)}
    </>
  );
}

export function LibraryConsole() {
  const params = useSearchParams();
  const requestedWorkspace = params.get("workspace");
  const itemId = params.get("item");
  const revisionId = params.get("revision");
  const { state, retry } = useSession();
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error") return <AuthFrame><h1>{isSignInRequired(state.error) ? "Sign in to Library" : "Couldn’t open Library"}</h1>{isSignInRequired(state.error) ? <><p className={styles.muted}>Use your workspace email to continue.</p><Link className={styles.primary} href={`/sign-in/?returnTo=${encodeURIComponent(requestedWorkspace ? libraryUrl(requestedWorkspace, itemId ?? undefined, revisionId ?? undefined) : "/workspaces/")}`}>Continue with email</Link></> : <><ErrorNotice message={errorMessage(state.error)} /><div className={styles.inlineNote}><button className={styles.secondary} onClick={retry}>Try again</button></div></>}</AuthFrame>;
  const workspace = state.session.workspaces.find((entry) => entry.id === requestedWorkspace);
  if (!workspace) return <ConsoleFrame session={state.session}><h1>Workspace unavailable</h1><p className={styles.muted}>This workspace isn’t available to you.</p><Link className={styles.primary} href="/workspaces/">Choose a workspace</Link></ConsoleFrame>;
  return <ConsoleFrame session={state.session} workspace={workspace} active="library">{itemId ? <Detail workspace={workspace} session={state.session} itemId={itemId} revisionId={revisionId} /> : <Listing workspace={workspace} />}</ConsoleFrame>;
}
