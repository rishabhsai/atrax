"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ApiError,
  errorMessage,
  operation,
  type WorkspaceMember,
} from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import consoleStyles from "./console.module.css";
import styles from "./sharing.module.css";

type Audience = "workspace" | "selected";
type AppAccess = {
  appId: string;
  audience: Audience;
  personIds: string[];
  maintainerPersonIds: string[];
  revision: number;
};
type ActionAccess = {
  appId: string;
  actionName: string;
  audience: Audience;
  personIds: string[];
  deniedPersonIds: string[];
  revision: number;
};
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; access: AppAccess; members: WorkspaceMember[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Atrax returned incomplete sharing information.", "invalid_response", true);
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown): string {
  if (typeof value !== "string")
    throw new ApiError("Atrax returned incomplete sharing information.", "invalid_response", true);
  return value;
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new ApiError("Atrax returned an invalid policy revision.", "invalid_response", true);
  return value;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value))
    throw new ApiError("Atrax returned incomplete sharing information.", "invalid_response", true);
  return value.map(text);
}

function audience(value: unknown): Audience {
  if (value !== "workspace" && value !== "selected")
    throw new ApiError("Atrax returned an invalid audience.", "invalid_response", true);
  return value;
}

function parseAppAccess(value: unknown): AppAccess {
  const row = object(object(value).access);
  return {
    appId: text(row.appId),
    audience: audience(row.audience),
    personIds: ids(row.personIds),
    maintainerPersonIds: ids(row.maintainerPersonIds),
    revision: integer(row.revision),
  };
}

function parseActionAccess(value: unknown): ActionAccess {
  const row = object(object(value).access);
  return {
    appId: text(row.appId),
    actionName: text(row.actionName),
    audience: audience(row.audience),
    personIds: ids(row.personIds),
    deniedPersonIds: ids(row.deniedPersonIds),
    revision: integer(row.revision),
  };
}

function parseMembers(value: unknown): WorkspaceMember[] {
  const rows = object(value).members;
  if (!Array.isArray(rows))
    throw new ApiError("Atrax returned incomplete team information.", "invalid_response", true);
  return rows.map((value) => {
    const row = object(value);
    return { personId: text(row.personId), email: text(row.email), role: text(row.role) };
  });
}

function idempotencyKey(): string {
  return crypto.randomUUID();
}

function PersonPicker({
  label,
  members,
  selected,
  onChange,
  unavailable = [],
}: {
  label: string;
  members: WorkspaceMember[];
  selected: string[];
  onChange: (personIds: string[]) => void;
  unavailable?: string[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const unavailableSet = useMemo(() => new Set(unavailable), [unavailable]);
  const filtered = members.filter((member) =>
    member.email.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const chosen = selected
    .map((personId) => members.find((member) => member.personId === personId))
    .filter((member): member is WorkspaceMember => Boolean(member));

  function close() {
    setOpen(false);
    setQuery("");
  }

  function move(index: number, direction: -1 | 1) {
    const next = (index + direction + filtered.length) % filtered.length;
    optionRefs.current[next]?.focus();
  }

  function toggle(personId: string) {
    onChange(
      selectedSet.has(personId)
        ? selected.filter((id) => id !== personId)
        : [...selected, personId],
    );
  }

  function optionKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      document.getElementById(`${id}-button`)?.focus();
    }
  }

  return (
    <div className={styles.picker}>
      <span className={styles.fieldLabel}>{label}</span>
      <button
        id={`${id}-button`}
        className={consoleStyles.secondary}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => {
          setOpen((value) => !value);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        {open ? "Close people list" : "Choose people"}
      </button>
      {open && (
        <div
          id={`${id}-options`}
          className={styles.pickerPanel}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              document.getElementById(`${id}-button`)?.focus();
            }
          }}
        >
          <label htmlFor={`${id}-search`}>Filter people</label>
          <input
            ref={inputRef}
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && filtered.length) {
                event.preventDefault();
                optionRefs.current[0]?.focus();
              }
            }}
          />
          <div className={styles.checklist}>
            {filtered.length ? (
              filtered.map((member, index) => (
                <label key={member.personId}>
                  <input
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="checkbox"
                    checked={selectedSet.has(member.personId)}
                    disabled={unavailableSet.has(member.personId)}
                    onChange={() => toggle(member.personId)}
                    onKeyDown={(event) => optionKeyDown(event, index)}
                  />
                  <span>
                    {member.email}
                    <small>{member.role}</small>
                  </span>
                </label>
              ))
            ) : (
              <p className={consoleStyles.muted}>No people match that filter.</p>
            )}
          </div>
        </div>
      )}
      {chosen.length ? (
        <ul className={styles.selectedPeople} aria-label={`Selected for ${label}`}>
          {chosen.map((member) => (
            <li key={member.personId}>
              <span>{member.email}</span>
              <button
                type="button"
                aria-label={`Remove ${member.email} from ${label}`}
                onClick={() => toggle(member.personId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.selectionEmpty}>No people selected.</p>
      )}
    </div>
  );
}

function AudienceChoice({ value, onChange }: { value: Audience; onChange: (value: Audience) => void }) {
  const id = useId();
  return (
    <fieldset className={styles.choiceGroup}>
      <legend>Who can use it</legend>
      <label>
        <input type="radio" name={`${id}-audience`} checked={value === "workspace"} onChange={() => onChange("workspace")} />
        <span><strong>Everyone in the workspace</strong><small>New team members receive access automatically.</small></span>
      </label>
      <label>
        <input type="radio" name={`${id}-audience`} checked={value === "selected"} onChange={() => onChange("selected")} />
        <span><strong>Selected people</strong><small>Only the people you choose can use it.</small></span>
      </label>
    </fieldset>
  );
}

function ActionPolicy({ appId, actionName, members }: { appId: string; actionName: string; members: WorkspaceMember[] }) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; access: ActionAccess }>({ kind: "loading" });
  const [draft, setDraft] = useState<{ audience: Audience; personIds: string[]; deniedPersonIds: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [conflict, setConflict] = useState<ActionAccess | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    operation("actions.access.get", { appId, actionName }, parseActionAccess, { signal: controller.signal }).then(
      (access) => {
        setState({ kind: "ready", access });
        setDraft({ audience: access.audience, personIds: access.personIds, deniedPersonIds: access.deniedPersonIds });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [appId, actionName, attempt]);

  async function save() {
    if (state.kind !== "ready" || !draft) return;
    setSaving(true);
    setNotice(null);
    try {
      const access = await operation(
        "actions.access.set",
        { appId, actionName, ...draft, expectedRevision: state.access.revision },
        parseActionAccess,
        { key: idempotencyKey() },
      );
      setState({ kind: "ready", access });
      setDraft({ audience: access.audience, personIds: access.personIds, deniedPersonIds: access.deniedPersonIds });
      setConflict(null);
      setNotice({ kind: "success", message: `${actionName} access saved.` });
    } catch (error) {
      if (error instanceof ApiError && error.code === "policy_revision_conflict") {
        try {
          const current = await operation("actions.access.get", { appId, actionName }, parseActionAccess);
          setState({ kind: "ready", access: current });
          setConflict(current);
        } catch {
          const revision = error.details?.currentRevision;
          if (typeof revision === "number") setState({ kind: "ready", access: { ...state.access, revision } });
        }
        setNotice({ kind: "error", message: "This action policy changed elsewhere. Your draft is still here; compare it with the current policy before saving again." });
      } else setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className={styles.actionPolicy}>
      <summary><code>{actionName}</code><span>{state.kind === "ready" ? (state.access.audience === "workspace" ? "Workspace default" : "Selected people") : "Access settings"}</span></summary>
      <div className={styles.actionBody}>
        {state.kind === "loading" && <p role="status">Loading action access…</p>}
        {state.kind === "error" && <><ErrorNotice message={state.message} /><button className={consoleStyles.secondary} type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((value) => value + 1); }}>Try again</button></>}
        {state.kind === "ready" && draft && (
          <>
            <AudienceChoice value={draft.audience} onChange={(value) => setDraft({ ...draft, audience: value, personIds: value === "workspace" ? [] : draft.personIds })} />
            {draft.audience === "selected" && <PersonPicker label="People who can use this action" members={members} selected={draft.personIds} unavailable={draft.deniedPersonIds} onChange={(personIds) => setDraft({ ...draft, personIds })} />}
            <PersonPicker label="People explicitly blocked from this action" members={members} selected={draft.deniedPersonIds} unavailable={draft.personIds} onChange={(deniedPersonIds) => setDraft({ ...draft, deniedPersonIds })} />
            {notice?.kind === "error" && <ErrorNotice message={notice.message} />}
            {notice?.kind === "success" && <p className={consoleStyles.success} role="status">{notice.message}</p>}
            {conflict && (
              <div className={styles.conflictReview}>
                <strong>Current saved policy</strong>
                <span>{conflict.audience === "workspace" ? "Everyone in the workspace" : `${conflict.personIds.length} selected ${conflict.personIds.length === 1 ? "person" : "people"}`}</span>
                <span>{conflict.deniedPersonIds.length} explicitly blocked</span>
                <button className={consoleStyles.secondary} type="button" onClick={() => { setDraft({ audience: conflict.audience, personIds: conflict.personIds, deniedPersonIds: conflict.deniedPersonIds }); setConflict(null); setNotice(null); }}>Use current policy</button>
              </div>
            )}
            <div className={consoleStyles.actions}><button className={consoleStyles.primary} type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save action access"}</button></div>
          </>
        )}
      </div>
    </details>
  );
}

export function SharingPanel({ appId, workspaceId, actionNames, canManageAccess, canManageMaintainers, onAppAccessSaved }: { appId: string; workspaceId: string; actionNames: string[]; canManageAccess: boolean; canManageMaintainers: boolean; onAppAccessSaved?: (audience: Audience) => void }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [audienceDraft, setAudienceDraft] = useState<{ audience: Audience; personIds: string[] } | null>(null);
  const [maintainersDraft, setMaintainersDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState<"access" | "maintainers" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [conflict, setConflict] = useState<AppAccess | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canManageMaintainers) return;
    const controller = new AbortController();
    Promise.all([
      operation("apps.access.get", { appId }, parseAppAccess, { signal: controller.signal }),
      operation("members.list", { workspaceId }, parseMembers, { signal: controller.signal }),
    ]).then(
      ([access, members]) => {
        setState({ kind: "ready", access, members });
        setAudienceDraft({ audience: access.audience, personIds: access.personIds });
        setMaintainersDraft(access.maintainerPersonIds);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [appId, workspaceId, canManageMaintainers, attempt]);

  async function saveAppAccess() {
    if (state.kind !== "ready" || !audienceDraft) return;
    await saveSharedRevision("access", "apps.access.set", { appId, ...audienceDraft, expectedRevision: state.access.revision });
  }

  async function saveMaintainers() {
    if (state.kind !== "ready") return;
    if (!maintainersDraft.length) {
      setNotice({ kind: "error", message: "An app needs at least one maintainer." });
      return;
    }
    await saveSharedRevision("maintainers", "apps.maintainers.set", { appId, personIds: maintainersDraft, expectedRevision: state.access.revision });
  }

  async function saveSharedRevision(kind: "access" | "maintainers", name: string, input: unknown) {
    if (state.kind !== "ready") return;
    setSaving(kind);
    setNotice(null);
    try {
      const access = await operation(name, input, parseAppAccess, { key: idempotencyKey() });
      setState({ ...state, access });
      if (kind === "access") {
        setAudienceDraft({ audience: access.audience, personIds: access.personIds });
        onAppAccessSaved?.(access.audience);
      }
      else setMaintainersDraft(access.maintainerPersonIds);
      setConflict(null);
      setNotice({ kind: "success", message: kind === "access" ? "App access saved." : "Maintainers saved." });
    } catch (error) {
      if (error instanceof ApiError && error.code === "policy_revision_conflict") {
        try {
          const current = await operation("apps.access.get", { appId }, parseAppAccess);
          setState({ ...state, access: current });
          setConflict(current);
        } catch {
          const revision = error.details?.currentRevision;
          if (typeof revision === "number") setState({ ...state, access: { ...state.access, revision } });
        }
        setNotice({ kind: "error", message: "These app settings changed elsewhere. Your draft is still here; compare it with the current settings before saving again." });
      } else setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setSaving(null);
    }
  }

  if (!canManageMaintainers)
    return (
      <section className={styles.sharingSection} aria-labelledby="app-access-heading">
        <h2 id="app-access-heading">Access</h2>
        <p className={consoleStyles.muted}>Only an app maintainer can change app access and action access.</p>
      </section>
    );

  return (
    <section className={styles.sharingSection} aria-labelledby="app-access-heading">
      <div className={styles.sectionHeading}><div><h2 id="app-access-heading">Access</h2><p>Choose who can open this app and use each exposed action.</p></div></div>
      {state.kind === "loading" && <><div className={consoleStyles.skeleton} aria-hidden="true" /><p role="status">Loading access settings…</p></>}
      {state.kind === "error" && <div className={styles.stack}><ErrorNotice message={state.message} /><button className={consoleStyles.secondary} type="button" onClick={() => { setState({ kind: "loading" }); setAttempt((value) => value + 1); }}>Try again</button></div>}
      {state.kind === "ready" && audienceDraft && (
        <div className={styles.stack}>
          <div className={styles.policyBlock}>
            <div><h3>App audience</h3><p className={consoleStyles.muted}>Controls who can open the app.</p></div>
            {canManageAccess ? <><AudienceChoice value={audienceDraft.audience} onChange={(value) => setAudienceDraft({ audience: value, personIds: value === "workspace" ? [] : audienceDraft.personIds })} />
              {audienceDraft.audience === "selected" && <PersonPicker label="People with app access" members={state.members} selected={audienceDraft.personIds} onChange={(personIds) => setAudienceDraft({ ...audienceDraft, personIds })} />}
              <button className={consoleStyles.primary} type="button" disabled={saving !== null} onClick={saveAppAccess}>{saving === "access" ? "Saving…" : "Save app access"}</button></> : <p className={consoleStyles.muted}>Only an app maintainer can change app access.</p>}
          </div>
          <div className={styles.policyBlock}>
            <div><h3>Maintainers</h3><p className={consoleStyles.muted}>Maintainers can deploy this app and manage its access.</p></div>
            <PersonPicker label="App maintainers" members={state.members} selected={maintainersDraft} onChange={setMaintainersDraft} />
            <button className={consoleStyles.primary} type="button" disabled={saving !== null} onClick={saveMaintainers}>{saving === "maintainers" ? "Saving…" : "Save maintainers"}</button>
          </div>
          {notice?.kind === "error" && <ErrorNotice message={notice.message} />}
          {notice?.kind === "success" && <p className={consoleStyles.success} role="status">{notice.message}</p>}
          {conflict && (
            <div className={styles.conflictReview}>
              <strong>Current saved app settings</strong>
              <span>{conflict.audience === "workspace" ? "Everyone in the workspace" : `${conflict.personIds.length} selected ${conflict.personIds.length === 1 ? "person" : "people"}`}</span>
              <span>{conflict.maintainerPersonIds.length} {conflict.maintainerPersonIds.length === 1 ? "maintainer" : "maintainers"}</span>
              <button className={consoleStyles.secondary} type="button" onClick={() => { setAudienceDraft({ audience: conflict.audience, personIds: conflict.personIds }); setMaintainersDraft(conflict.maintainerPersonIds); setConflict(null); setNotice(null); }}>Use current settings</button>
            </div>
          )}
          <div className={styles.actionsBlock}>
            <div><h3>Action access</h3><p className={consoleStyles.muted}>Actions start with workspace access. Selected people and explicit blocks apply only to that action.</p></div>
            {canManageAccess ? (actionNames.length ? actionNames.map((actionName) => <ActionPolicy key={actionName} appId={appId} actionName={actionName} members={state.members} />) : <p className={styles.emptyState}>This release does not expose any named actions.</p>) : <p className={styles.emptyState}>Only an app maintainer can view or change action access.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
