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
  type LibraryDetail,
  type LibraryRevision,
  type LibrarySource,
  type LibrarySummary,
  type Session,
  type Workspace,
  type WorkspaceMember,
} from "./api";
import { ErrorNotice, PageLoading } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import { ConsoleArtwork } from "./ConsoleArtwork";
import styles from "./library-views.module.css";

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
      <p className={styles.eyebrow}>Library / {existing ? "Edit entry" : "New entry"}</p>
      <h1 id={existing ? "correct-entry" : "add-entry"}>{existing ? "Correct this entry" : "Add an entry"}</h1>
      <p className={styles.muted}>{existing ? "Save a new revision. Previous versions stay in history." : "Save a policy, decision, or guidance your team can refer to."}</p>
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
        <details className={styles.disclosure} open={sources.length > 0}><summary>Source revisions <span>{sources.length ? `${sources.length} cited` : "Optional"}</span></summary><SourcesEditor sources={sources} onChange={setSources} /></details>
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
  return <section className={styles.editor} aria-labelledby="upload-file"><p className={styles.eyebrow}>Library / {detail ? "Replace file" : "New file"}</p><h1 id="upload-file">{detail ? "Replace file" : "Upload a file"}</h1><p className={styles.muted}>{detail ? "The new file becomes the current revision. Earlier files stay in history." : "Add a document for your team to read and download."}</p><form className={styles.form} onSubmit={submit}>
    <div className={styles.field}>
      <label htmlFor="library-file">File</label>
      <input id="library-file" type="file" required accept={accepted.join(",")} disabled={capabilities.kind !== "ready" || saving} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} />
      {capabilities.kind === "loading" && <small>Checking supported file types…</small>}
      {capabilities.kind === "ready" && <small>Up to {formatBytes(capabilities.value.maxBytes)} per file.</small>}
      {file && <small>Selected {file.name} ({formatBytes(file.size)}).</small>}
      {capabilities.kind === "ready" && <details className={styles.fileHelp}><summary>Supported files and search</summary><p>Supported file types: {accepted.join(", ")}. UTF-8 text files up to {formatBytes(capabilities.value.searchableTextMaxBytes)} are searchable. Other supported files are available to download.</p></details>}
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
      <p className={styles.eyebrow}>Library / Access</p><h1 id="library-access">Who can read this item?</h1><p className={styles.itemContext}>{detail.item.title}</p>
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
  if (state.kind === "loading") return <PageLoading label="Loading Library item…" />;
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
    <div className={styles.detail}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href={libraryUrl(workspace.id)}>← Library</Link><span aria-hidden="true">/</span><span>{revision.title}</span></nav>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{item.kind === "knowledge" ? "Knowledge entry" : "File"} · Version {revision.number}</p>
          <h1>{revision.title}</h1>
          <p>{audienceLabel(item.audience)} · Updated {dateTime(revision.createdAt)}</p>
        </div>
        <div className={styles.actions}>
          {item.kind === "knowledge" && current && item.status === "active" && <button className={styles.primary} onClick={() => setEditing(true)}>Edit entry</button>}
          {item.kind === "file" && revision.file && <button className={styles.primary} onClick={download}>Download original</button>}
          {item.kind === "file" && current && item.status === "active" && <button className={styles.secondary} onClick={() => setReplacing(true)}>Replace file</button>}
        </div>
      </header>
      {error && <ErrorNotice message={error} />}
      {item.status !== "active" && <p className={styles.notice}>This item is archived. Its history is available, but it no longer appears in Library search.</p>}
      {!current && <p className={styles.notice}>You are reading version {revision.number}. <Link href={libraryUrl(workspace.id, item.id)}>Read the current version</Link>.</p>}
      <div className={styles.detailLayout}>
        <div className={styles.readingColumn}>
          <section className={styles.libraryContent} aria-labelledby="library-content-heading">
            <h2 id="library-content-heading">{item.kind === "file" && revision.text ? "File text" : "Content"}</h2>
            {item.kind === "knowledge" || revision.text ? <div>{revision.text}</div> : <div className={styles.downloadPrompt}><p>This file is available to download.</p><p className={styles.muted}>A text preview is not available for this file.</p>{revision.file && <button className={styles.secondary} onClick={download}>Download {revision.file.filename}</button>}</div>}
          </section>
          {revision.sourceRevisions.length > 0 && <details className={styles.disclosure}><summary>Sources <span>{revision.sourceRevisions.length} cited revisions</span></summary><div className={styles.disclosureBody}><p className={styles.muted}>This entry cites these exact revisions. Their access rules also apply to this entry.</p><ul className={styles.sourceLinks}>{revision.sourceRevisions.map((source, index) => <li key={`${source.itemId}:${source.revisionId}`}><Link href={libraryUrl(workspace.id, source.itemId, source.revisionId)}>Source {index + 1}<code>{source.revisionId}</code></Link></li>)}</ul></div></details>}
          <details className={styles.disclosure} open={!current}>
            <summary>Revision history <span>{history.kind === "ready" ? `${history.value.length} ${history.value.length === 1 ? "version" : "versions"}` : ""}</span></summary>
            <div className={styles.disclosureBody}>
              {history.kind === "loading" && <p role="status" className={styles.muted}>Loading history…</p>}
              {history.kind === "error" && <ErrorNotice message={history.message} />}
              {history.kind === "ready" && <ol className={styles.revisionList}>{history.value.map((entry) => <li key={entry.id}><Link href={libraryUrl(workspace.id, item.id, entry.id)} aria-current={entry.id === revision.id ? "page" : undefined}>Version {entry.number}{entry.id === item.currentRevisionId ? " · Current" : ""}</Link><span>{entry.author.email}{entry.author.agentLabel ? ` via ${entry.author.agentLabel}` : ""}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{dateTime(entry.createdAt)}</time><p>{entry.reason}</p></li>)}</ol>}
            </div>
          </details>
        </div>
        <aside className={styles.itemAside} aria-label="Item details">
          <h2>About this {item.kind === "file" ? "file" : "entry"}</h2>
          <dl className={styles.libraryMeta}>
            <div><dt>Contributed by</dt><dd>{revision.author.email}{revision.author.agentLabel && <span>via {revision.author.agentLabel}</span>}</dd></div>
            <div><dt>Version</dt><dd>{revision.number}{current ? " · Current" : " · Previous"}</dd></div>
            <div><dt>Search</dt><dd>{revision.indexingStatus === "ready" ? "Searchable" : revision.indexingStatus === "stored_without_text" ? "Stored, not searchable" : revision.indexingStatus}</dd></div>
            {revision.file && <><div><dt>Original file</dt><dd>{revision.file.filename}</dd></div><div><dt>Size</dt><dd>{formatBytes(revision.file.byteSize)}</dd></div></>}
          </dl>
          <div className={styles.accessSummary}><h2>Access</h2><p>{audienceLabel(item.audience)}</p>{canManage && item.status === "active" && <button className={styles.secondary} onClick={() => setAccess(true)}>Manage access</button>}</div>
          {canManage && item.status === "active" && <details className={styles.archiveDisclosure}><summary>Archive item</summary><p>Remove this item from browsing and search. Its history stays available.</p><button className={styles.danger} onClick={archive} disabled={archiving}>{archiving ? "Archiving…" : "Archive item"}</button></details>}
        </aside>
      </div>
    </div>
  );
}

function Listing({ workspace }: { workspace: Workspace }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const [filter, setFilter] = useState<"all" | "knowledge" | "file">("all");
  const [result, setResult] = useState<{ query: string; state: LoadState<LibrarySummary[]> }>({ query, state: { kind: "loading" } });
  const [adding, setAdding] = useState<"entry" | "file" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.listLibrary(workspace.id, query.trim(), controller.signal).then(
      (value) => setResult({ query, state: { kind: "ready", value } }),
      (failure: unknown) => !controller.signal.aborted && setResult({ query, state: { kind: "error", message: errorMessage(failure) } }),
    );
    return () => controller.abort();
  }, [workspace.id, query, attempt]);
  function updateQuery(value: string) {
    window.history.replaceState(window.history.state, "", changedUrl({ q: value || null }));
  }
  if (adding === "entry") return <EntryForm workspaceId={workspace.id} onSaved={(detail) => router.push(libraryUrl(workspace.id, detail.item.id, detail.revision.id))} onCancel={() => setAdding(null)} />;
  if (adding === "file") return <FileUploadForm workspaceId={workspace.id} onSaved={(detail) => router.push(libraryUrl(workspace.id, detail.item.id, detail.revision.id))} onCancel={() => setAdding(null)} />;
  const state: LoadState<LibrarySummary[]> = result.query === query ? result.state : { kind: "loading" };
  const items = state.kind === "ready" ? state.value.filter((item) => filter === "all" || item.kind === filter) : [];
  const counts = state.kind === "ready" ? { all: state.value.length, knowledge: state.value.filter((item) => item.kind === "knowledge").length, file: state.value.filter((item) => item.kind === "file").length } : null;
  const emptyLibrary = state.kind === "ready" && !state.value.length && !query.trim();
  return (
    <div className={styles.catalog}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>Company knowledge</p><h1>Library</h1><p>Files, decisions, and guidance your team shares.</p></div>
        <div className={styles.actions}><button className={styles.secondary} onClick={() => setAdding("file")}>Upload a file</button><button className={styles.primary} onClick={() => setAdding("entry")}>Add entry</button></div>
      </header>
      <section className={styles.catalogSurface} aria-label="Library catalog">
        <div className={styles.libraryToolbar}>
          <div className={`${styles.field} ${styles.search}`}><label htmlFor="library-search">Search Library</label><input id="library-search" type="search" placeholder="Search titles and content" value={query} onChange={(event) => updateQuery(event.target.value)} /></div>
          <div className={styles.filterGroup} role="group" aria-label="Filter by item type">
            <button className={filter === "all" ? styles.filterActive : styles.filterButton} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All items{counts && <span>{counts.all}</span>}</button>
            <button className={filter === "knowledge" ? styles.filterActive : styles.filterButton} aria-pressed={filter === "knowledge"} onClick={() => setFilter("knowledge")}>Entries{counts && <span>{counts.knowledge}</span>}</button>
            <button className={filter === "file" ? styles.filterActive : styles.filterButton} aria-pressed={filter === "file"} onClick={() => setFilter("file")}>Files{counts && <span>{counts.file}</span>}</button>
          </div>
        </div>
        {state.kind === "loading" && <div className={styles.loading}><div className={styles.skeleton} aria-hidden="true" /><p role="status">{query ? "Searching Library…" : "Loading Library…"}</p></div>}
        {state.kind === "error" && <div className={styles.loading}><ErrorNotice message={state.message} /><div className={styles.inlineNote}><button className={styles.secondary} onClick={() => { setResult({ query, state: { kind: "loading" } }); setAttempt((value) => value + 1); }}>Try again</button></div></div>}
        {state.kind === "ready" && <>
          {!emptyLibrary && <div className={styles.resultBar}><p role="status">{items.length} {items.length === 1 ? "item" : "items"}{query.trim() ? ` matching “${query.trim()}”` : ""}</p><span>Most recently updated</span></div>}
          {items.length ? <ul className={styles.libraryList}>{[...items].sort((a, b) => b.updatedAt - a.updatedAt).map((item) => <li key={item.id}>
            <Link className={styles.libraryRow} href={libraryUrl(workspace.id, item.id, item.revisionId)}>
              <span className={styles.itemKind} aria-hidden="true">{item.kind === "knowledge" ? "Aa" : "↓"}</span>
              <div className={styles.itemText}><strong>{item.title}</strong><span className={styles.rowMeta}>{item.kind === "knowledge" ? "Entry" : "File"} · {audienceLabel(item.audience)}{item.file ? ` · ${item.file.filename}` : ""}</span>{item.snippet && <p>{item.snippet}</p>}{item.sourceRevisions.length > 0 && <small>{item.sourceRevisions.length} cited {item.sourceRevisions.length === 1 ? "source" : "sources"}</small>}</div>
              <div className={styles.itemUpdated}><time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><span>{item.indexingStatus === "ready" ? "Searchable" : item.indexingStatus === "stored_without_text" ? "Download only" : item.indexingStatus}</span></div>
              <span className={styles.rowArrow} aria-hidden="true">↗</span>
            </Link>
          </li>)}</ul> : <section className={`${styles.empty} ${emptyLibrary ? styles.emptyWithArt : ""}`}>
            <div><h2>{emptyLibrary ? "Your team’s knowledge starts here." : query.trim() ? "No matching items" : filter === "file" ? "No files yet" : "No entries yet"}</h2><p>{emptyLibrary ? "Add written guidance or upload a document for your team to use." : query.trim() ? "Try another search or choose a different type." : filter === "file" ? "Upload a policy, reference, or other team document." : "Save a decision, policy, or piece of guidance."}</p>
              <div className={styles.actions}>{query.trim() ? <button className={styles.secondary} onClick={() => updateQuery("")}>Clear search</button> : <><button className={styles.primary} onClick={() => setAdding(!emptyLibrary && filter === "file" ? "file" : "entry")}>{!emptyLibrary && filter === "file" ? "Upload a file" : "Add an entry"}</button>{emptyLibrary && <button className={styles.secondary} onClick={() => setAdding("file")}>Upload a file</button>}</>}{!emptyLibrary && filter !== "all" && <button className={styles.secondary} onClick={() => setFilter("all")}>Show all types</button>}</div>
            </div>{emptyLibrary && <ConsoleArtwork kind="library" />}
          </section>}
        </>}
      </section>
    </div>
  );
}

export function LibraryConsole() {
  const params = useSearchParams();
  const requestedWorkspace = params.get("workspace");
  const itemId = params.get("item");
  const revisionId = params.get("revision");
  const { state } = useSession();
  if (state.kind !== "ready") return null;
  const workspace = state.session.workspaces.find((entry) => entry.id === requestedWorkspace);
  if (!workspace) return <><h1>Workspace unavailable</h1><p className={styles.muted}>This workspace isn’t available to you.</p><Link className={styles.primary} href="/workspaces/">Choose a workspace</Link></>;
  return <>{itemId ? <Detail key={`${workspace.id}:${itemId}:${revisionId ?? "current"}`} workspace={workspace} session={state.session} itemId={itemId} revisionId={revisionId} /> : <Listing key={workspace.id} workspace={workspace} />}</>;
}
