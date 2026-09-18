export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type Session = {
  person: { id: string; email: string };
  session: { id: string; expiresAt: number };
  workspaces: Workspace[];
  invitations: Invitation[];
};

export type App = {
  id: string;
  name: string;
  slug: string;
  url: string;
  status: string;
  audience: string;
  activeReleaseId: string | null;
  canOpen: boolean;
  canMaintain: boolean;
  canManageMaintainers: boolean;
};
export type Invitation = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
  expiresAt: number;
};
export type AppDetails = {
  app: Omit<App, "canOpen" | "canMaintain" | "canManageMaintainers"> & {
    workspaceId: string;
    activeReleaseId: string | null;
  };
  capabilities: {
    canOpen: boolean;
    maintain: boolean;
    manageAccess: boolean;
    canManageMaintainers: boolean;
  };
  release: {
    id: string;
    hash: string;
    createdAt: number;
    actions: { name: string; description: string; effect: string }[];
  } | null;
};

export type LibrarySource = { itemId: string; revisionId: string };
export type LibraryItem = {
  id: string; workspaceId: string; kind: string; status: string;
  audience: string; personIds: string[]; currentRevisionId: string;
  title: string; createdBy: string; createdAt: number; updatedAt: number;
  indexingStatus: string;
};
export type LibraryRevision = {
  id: string; number: number; title: string; text: string; reason: string;
  author: { personId: string; email: string; kind: string; agentLabel: string | null };
  createdAt: number; sourceRevisions: LibrarySource[]; indexingStatus: string;
  file?: LibraryFile;
};
export type LibraryFile = {
  filename: string; contentType: string; byteSize: number; sha256: string; uploadedAt: number;
};
export type LibraryDetail = { item: LibraryItem; revision: LibraryRevision };
export type LibrarySummary = LibraryItem & { revisionId: string; sourceRevisions: LibrarySource[]; snippet: string | null; file?: LibraryFile };
export type WorkspaceMember = { personId: string; email: string; role: string };
export type PublicPublication = {
  public: boolean;
  publicationRevision: number;
  activeReleaseId: string | null;
};
export type ExternalGuest = { personId: string; email: string; actionNames: string[]; revision: string };
export type ExternalGuestInvitation = { id: string; email: string; status: "pending" | "accepted" | "expired" | "cancelled" | "revoked"; actionNames: string[]; expiresAt: number };
export type ExternalGuestAccess = {
  guests: ExternalGuest[];
  invitations: ExternalGuestInvitation[];
  grantableActionNames: string[];
};

export type OperationFailure = { code: string; message: string; retryable: boolean };
export type DeploymentJob = {
  id: string; status: string; phase: string; releaseId: string;
  candidateUrl: string | null; error: OperationFailure | null;
};
export type AppOperationsData = {
  app: { status: string; activeReleaseId: string | null };
  database: { present: boolean };
  deployments: (DeploymentJob & {
    kind: "deploy" | "rollback" | "restore"; mode: "live" | "preview";
    createdAt: number; updatedAt: number; createdBy: string;
  })[];
  releases: { id: string; hash: string; createdAt: number; createdBy: string; rollbackEligible: boolean }[];
  backups: {
    id: string; releaseId: string; status: string; phase: string; createdAt: number; updatedAt: number;
    snapshotCreatedAt: number | null; size: number | null; error: OperationFailure | null;
  }[];
  usage: {
    windowHours: number; since: number; until: number; total: number; succeeded: number;
    failed: number; running: number; interrupted: number;
    byAction: { actionName: string; total: number; succeeded: number; failed: number; running: number; interrupted: number }[];
  };
};
export type RestorePlan = {
  backupId: string; releaseId: string; expectedReleaseId: string;
  originalDatabaseId: string; snapshotCreatedAt: number; snapshotCompletedAt: number;
  connectedAppIds: string[]; retainsOriginalDatabase: true; warning: string;
};
export type RestoreConfirmation = {
  originalDatabaseId: string; snapshotCreatedAt: number; connectedAppIds: string[]; retainOriginalDatabase: true;
};
export type SecretGrant = { appId: string; bindingName: string };
export type WorkspaceSecret = {
  id: string; workspaceId: string; name: string; description: string; status: "active" | "revoked";
  revision: number; apps: SecretGrant[]; createdBy: string; createdAt: number; updatedAt: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(
      "Atrax returned an unreadable response. Please try again.",
      "invalid_response",
      true,
    );
  }
  return Object.fromEntries(Object.entries(value));
}

function string(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(
      "Atrax returned an incomplete response. Please try again.",
      "invalid_response",
      true,
    );
  }
  return value;
}

function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ApiError(
      "Atrax returned an invalid expiry. Please try again.",
      "invalid_response",
      true,
    );
  return value;
}

function workspace(value: unknown): Workspace {
  const item = record(value);
  return {
    id: string(item.id),
    name: string(item.name),
    slug: string(item.slug),
    role: string(item.role),
  };
}

function workspaceResult(value: unknown): Workspace {
  const result = record(value);
  const item = record(result.workspace);
  const membership = record(result.membership);
  return {
    id: string(item.id),
    name: string(item.name),
    slug: string(item.slug),
    role: string(membership.role),
  };
}

function identity(value: unknown): Pick<Session, "person" | "session"> {
  const result = record(value);
  const person = record(result.person);
  const current = record(result.session);
  return {
    person: { id: string(person.id), email: string(person.email) },
    session: {
      id: string(current.id),
      expiresAt: timestamp(current.expiresAt),
    },
  };
}

const sessionFailureListeners = new Set<() => void>();
export function onSessionFailure(listener: () => void) {
  sessionFailureListeners.add(listener);
  return () => { sessionFailureListeners.delete(listener); };
}

export async function operation<T>(
  name: string,
  input: unknown,
  parse: (value: unknown) => T,
  options: { key?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const origin =
    process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "https://api.atrax.run";
  let response: Response;
  try {
    response = await fetch(
      `${origin.replace(/\/$/, "")}/v1/operations/${name}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(options.key ? { "Idempotency-Key": options.key } : {}),
        },
        body: JSON.stringify(input),
        signal: options.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Couldn't reach Atrax. Check your connection and try again.",
      "network_error",
      true,
    );
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ApiError(
      "Atrax couldn't complete this request. Please try again.",
      "invalid_response",
      true,
    );
  }
  const envelope = record(raw);
  if (envelope.status === "failed") {
    const failure = record(envelope.error);
    const error = new ApiError(
      string(failure.message),
      string(failure.code),
      failure.retryable === true,
      failure.details === undefined ? undefined : record(failure.details),
    );
    if (!options.signal?.aborted && isSignInRequired(error)) sessionFailureListeners.forEach((listener) => listener());
    throw error;
  }
  if (
    !response.ok ||
    envelope.schemaVersion !== 1 ||
    envelope.status !== "succeeded" ||
    typeof envelope.operationId !== "string"
  ) {
    throw new ApiError(
      "Atrax returned an unexpected result. Please try again.",
      "invalid_response",
      true,
    );
  }
  return parse(envelope.result);
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new ApiError("Atrax returned incomplete information. Please try again.", "invalid_response", true);
  return value;
}
function sources(value: unknown): LibrarySource[] {
  return array(value).map(value => { const source = record(value); return { itemId: string(source.itemId), revisionId: string(source.revisionId) }; });
}
function libraryItem(value: unknown): LibraryItem {
  const item = record(value);
  return { id: string(item.id), workspaceId: string(item.workspaceId), kind: string(item.kind), status: string(item.status), audience: string(item.audience), personIds: array(item.personIds).map(string), currentRevisionId: string(item.currentRevisionId), title: string(item.title), createdBy: string(item.createdBy), createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), indexingStatus: string(item.indexingStatus) };
}
function libraryRevision(value: unknown): LibraryRevision {
  const item = record(value), author = record(item.author);
  return { id: string(item.id), number: timestamp(item.number), title: string(item.title), text: string(item.text), reason: string(item.reason), createdAt: timestamp(item.createdAt), indexingStatus: string(item.indexingStatus), sourceRevisions: sources(item.sourceRevisions), author: { personId: string(author.personId), email: string(author.email), kind: string(author.kind), agentLabel: author.agentLabel === null ? null : string(author.agentLabel) }, ...(item.file === undefined ? {} : { file: libraryFile(item.file) }) };
}
function libraryFile(value: unknown): LibraryFile {
  const item = record(value);
  return { filename: string(item.filename), contentType: string(item.contentType), byteSize: timestamp(item.byteSize), sha256: string(item.sha256), uploadedAt: timestamp(item.uploadedAt) };
}
function libraryDetail(value: unknown): LibraryDetail {
  const result = record(value); return { item: libraryItem(result.item), revision: libraryRevision(result.revision) };
}

function operationFailure(value: unknown): OperationFailure | null {
  if (value === null || value === undefined) return null;
  const item = record(value);
  return { code: string(item.code), message: string(item.message), retryable: item.retryable === true };
}
function deploymentJob(value: unknown): DeploymentJob {
  const item = record(value);
  return { id: string(item.id), status: string(item.status), phase: string(item.phase), releaseId: string(item.releaseId), candidateUrl: item.candidateUrl == null ? null : appUrl(item.candidateUrl), error: operationFailure(item.error) };
}
function appOperations(value: unknown): AppOperationsData {
  const result = record(value), usage = record(result.usage), app = record(result.app);
  return {
    app: { status: string(app.status), activeReleaseId: app.activeReleaseId === null ? null : string(app.activeReleaseId) },
    database: { present: record(result.database).present === true },
    deployments: array(result.deployments).map(value => {
      const item = record(value);
      if (item.kind !== "deploy" && item.kind !== "rollback" && item.kind !== "restore") throw new ApiError("Unknown deployment kind.", "invalid_response", true);
      if (item.mode !== "live" && item.mode !== "preview") throw new ApiError("Unknown deployment environment.", "invalid_response", true);
      return { ...deploymentJob(item), kind: item.kind, mode: item.mode, createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), createdBy: string(item.createdBy) };
    }),
    releases: array(result.releases).map(value => {
      const item = record(value);
      return { id: string(item.id), hash: string(item.hash), createdAt: timestamp(item.createdAt), createdBy: string(item.createdBy), rollbackEligible: item.rollbackEligible === true };
    }),
    backups: array(result.backups).map(value => {
      const item = record(value);
      return { id: string(item.id), releaseId: string(item.releaseId), status: string(item.status), phase: string(item.phase), createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), snapshotCreatedAt: item.snapshotCreatedAt === null ? null : timestamp(item.snapshotCreatedAt), size: item.size === null ? null : timestamp(item.size), error: operationFailure(item.error) };
    }),
    usage: {
      windowHours: timestamp(usage.windowHours), since: timestamp(usage.since), until: timestamp(usage.until),
      total: timestamp(usage.total), succeeded: timestamp(usage.succeeded), failed: timestamp(usage.failed), running: timestamp(usage.running), interrupted: timestamp(usage.interrupted),
      byAction: array(usage.byAction).map(value => {
        const item = record(value);
        return { actionName: string(item.actionName), total: timestamp(item.total), succeeded: timestamp(item.succeeded), failed: timestamp(item.failed), running: timestamp(item.running), interrupted: timestamp(item.interrupted) };
      }),
    },
  };
}
function restorePlan(value: unknown): RestorePlan {
  const item = record(record(value).plan);
  if (item.retainsOriginalDatabase !== true) throw new ApiError("The restore plan must retain the original database.", "invalid_response", true);
  return { backupId: string(item.backupId), releaseId: string(item.releaseId), expectedReleaseId: string(item.expectedReleaseId), originalDatabaseId: string(item.originalDatabaseId), snapshotCreatedAt: timestamp(item.snapshotCreatedAt), snapshotCompletedAt: timestamp(item.snapshotCompletedAt), connectedAppIds: array(item.connectedAppIds).map(string), retainsOriginalDatabase: true, warning: string(item.warning) };
}
function workspaceSecret(value: unknown): WorkspaceSecret {
  const item = record(value);
  if (item.status !== "active" && item.status !== "revoked") throw new ApiError("Unknown credential status.", "invalid_response", true);
  return { id: string(item.id), workspaceId: string(item.workspaceId), name: string(item.name), description: string(item.description), status: item.status, revision: timestamp(item.revision), createdBy: string(item.createdBy), createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), apps: array(item.apps).map(value => { const grant = record(value); return { appId: string(grant.appId), bindingName: string(grant.bindingName) }; }) };
}

export const api = {
  listSecrets: (workspaceId: string, signal?: AbortSignal) => operation("secrets.list", { workspaceId }, value => array(record(value).secrets).map(workspaceSecret), { signal }),
  createSecret: (input: { workspaceId: string; name: string; description: string; value: string }, key: string) => operation("secrets.create", input, value => workspaceSecret(record(value).secret), { key }),
  updateSecret: (input: { workspaceId: string; secretId: string; baseRevision: number; name: string; description: string }, key: string) => operation("secrets.update", input, value => workspaceSecret(record(value).secret), { key }),
  rotateSecret: (input: { workspaceId: string; secretId: string; baseRevision: number; value: string }, key: string) => operation("secrets.rotate", input, value => workspaceSecret(record(value).secret), { key }),
  setSecretApps: (input: { workspaceId: string; secretId: string; baseRevision: number; apps: SecretGrant[] }, key: string) => operation("secrets.setApps", input, value => workspaceSecret(record(value).secret), { key }),
  revokeSecret: (input: { workspaceId: string; secretId: string; baseRevision: number }, key: string) => operation("secrets.revoke", input, value => workspaceSecret(record(value).secret), { key }),
  getAppOperations: (appId: string, signal?: AbortSignal) => operation("apps.operations.get", { appId }, appOperations, { signal }),
  getDeployment: (appId: string, deploymentId: string, signal?: AbortSignal) => operation("deployments.get", { appId, deploymentId }, value => deploymentJob(record(value).deployment), { signal }),
  rollbackApp: (input: { appId: string; releaseId: string; expectedReleaseId: string }, key: string) => operation("deployments.rollback", input, value => deploymentJob(record(value).deployment), { key }),
  verifyDeployment: (input: { appId: string; deploymentId: string }, key: string) => operation("deployments.verify", input, value => deploymentJob(record(value).deployment), { key }),
  resumeDeployment: (input: { appId: string; deploymentId: string }, key: string) => operation("deployments.resume", input, value => deploymentJob(record(value).deployment), { key }),
  createBackup: (input: { appId: string; expectedReleaseId: string }, key: string) => operation("backups.create", input, value => deploymentJob(record(value).backup), { key }),
  resumeBackup: (input: { appId: string; backupId: string }, key: string) => operation("backups.resume", input, value => deploymentJob(record(value).backup), { key }),
  planRestore: (appId: string, backupId: string, signal?: AbortSignal) => operation("data.restore.plan", { appId, backupId }, restorePlan, { signal }),
  startRestore: (input: { appId: string; backupId: string; expectedReleaseId: string; confirmation: RestoreConfirmation }, key: string) => operation("data.restore.start", input, value => deploymentJob(record(value).deployment), { key }),
  listLibrary: (workspaceId: string, query: string, signal?: AbortSignal) => operation(query ? "library.search" : "library.list", { workspaceId, ...(query ? {query} : {}), limit: 100 }, value => array(record(value).items).map(value => { const row = record(value); return { ...libraryItem(row), revisionId: string(row.revisionId), sourceRevisions: sources(row.sourceRevisions), snippet: typeof row.snippet === "string" ? row.snippet : null, ...(row.file === undefined ? {} : { file: libraryFile(row.file) }) }; }), { signal }),
  getLibrary: (workspaceId: string, itemId: string, revisionId?: string, signal?: AbortSignal) => operation("library.get", { workspaceId, itemId, ...(revisionId ? { revisionId } : {}) }, libraryDetail, { signal }),
  libraryHistory: (workspaceId: string, itemId: string, signal?: AbortSignal) => operation("library.history", {workspaceId,itemId}, value => array(record(value).revisions).map(libraryRevision), {signal}),
  createEntry: (input: {workspaceId: string; title: string; text: string; sourceRevisions: LibrarySource[]}, key: string) => operation("library.entry.create", input, libraryDetail, {key}),
  reviseEntry: (input: {workspaceId: string; itemId: string; baseRevisionId: string; title: string; text: string; reason: string; sourceRevisions: LibrarySource[]}, key: string) => operation("library.entry.revise", input, libraryDetail, {key}),
  libraryArchive: (workspaceId: string, itemId: string, key: string) => operation("library.archive", {workspaceId,itemId}, value => libraryItem(record(value).item), {key}),
  libraryAccess: (input: {workspaceId: string; itemId: string; audience: "workspace" | "selected"; personIds: string[]}, key: string) => operation("library.setAccess", input, value => libraryItem(record(value).item), {key}),
  fileCapabilities: (workspaceId: string, signal?: AbortSignal) => operation("library.files.capabilities", { workspaceId }, value => { const result = record(value); return { maxBytes: timestamp(result.maxBytes), searchableTextMaxBytes: timestamp(result.searchableTextMaxBytes), acceptedContentTypes: array(result.acceptedContentTypes).map(string) }; }, {signal}),
  uploadFile: (input: { workspaceId: string; filename: string; contentType: string; contentBase64: string; title?: string }, key: string) => operation("library.file.upload", input, libraryDetail, {key}),
  replaceFile: (input: { workspaceId: string; itemId: string; baseRevisionId: string; filename: string; contentType: string; contentBase64: string; title?: string; reason: string }, key: string) => operation("library.file.replace", input, libraryDetail, {key}),
  downloadFile: (workspaceId: string, itemId: string, revisionId?: string, signal?: AbortSignal) => operation("library.file.download", { workspaceId, itemId, ...(revisionId ? {revisionId} : {}) }, value => { const result = record(value); return { file: libraryFile(result.file), contentBase64: string(result.contentBase64) }; }, {signal}),
  listMembers: (workspaceId: string, signal?: AbortSignal) => operation("members.list", {workspaceId}, value => array(record(value).members).map(value => { const member = record(value); return {personId: string(member.personId), email: string(member.email), role: string(member.role)}; }), {signal}),
  getSession: async (signal?: AbortSignal): Promise<Session> => {
    const current = await operation("auth.session.get", {}, identity, {
      signal,
    });
    const directory = await operation(
      "workspaces.list",
      {},
      (value) => {
        const result = record(value);
        if (
          !Array.isArray(result.workspaces) ||
          !Array.isArray(result.invitations)
        )
          throw new ApiError(
            "Workspace information is missing. Please try again.",
            "invalid_response",
            true,
          );
        return {
          workspaces: result.workspaces.map(workspace),
          invitations: result.invitations.map((value): Invitation => {
            const item = record(value);
            return {
              id: string(item.id),
              workspaceId: string(item.workspaceId),
              workspaceName: string(item.workspaceName),
              role: string(item.role),
              expiresAt: timestamp(item.expiresAt),
            };
          }),
        };
      },
      { signal },
    );
    return { ...current, ...directory };
  },
  startEmail: (
    input: { email: string; returnTo: string; purpose: "sign_in" },
    key: string,
  ) =>
    operation(
      "auth.email.start",
      input,
      (value) => {
        const result = record(value);
        if (result.delivery !== "sent")
          throw new ApiError(
            "The sign-in email could not be sent. Please try again.",
            "delivery_failed",
            true,
          );
        return {
          challengeId: string(result.challengeId),
          expiresAt: timestamp(result.expiresAt),
          delivery: result.delivery,
        };
      },
      { key },
    ),
  verifyEmail: (input: { challengeId: string; secret: string }, key: string) =>
    operation(
      "auth.email.verify",
      input,
      (value) => {
        const result = record(value);
        return { ...identity(value), returnTo: string(result.returnTo) };
      },
      { key },
    ),
  createWorkspace: (input: { name: string; slug: string }, key: string) =>
    operation("workspaces.create", input, workspaceResult, { key }),
  acceptInvitation: (input: { invitationId: string }, key: string) =>
    operation("members.accept", input, workspaceResult, { key }),
  listApps: (workspaceId: string, signal?: AbortSignal) =>
    operation(
      "apps.list",
      { workspaceId },
      (value) => {
        const result = record(value);
        if (!Array.isArray(result.apps))
          throw new ApiError(
            "App information is missing. Please try again.",
            "invalid_response",
            true,
          );
        return result.apps.map((value): App => {
          const item = record(value);
          return {
            id: string(item.id),
            name: string(item.name),
            slug: string(item.slug),
            url: appUrl(item.url),
            status: string(item.status),
            audience: string(item.audience),
            activeReleaseId:
              item.activeReleaseId === null
                ? null
                : string(item.activeReleaseId),
            canOpen: item.canOpen === true,
            canMaintain: item.canMaintain === true,
            canManageMaintainers: item.canManageMaintainers === true,
          };
        });
      },
      { signal },
    ),
  getApp: (appId: string, signal?: AbortSignal) =>
    operation(
      "apps.get",
      { appId },
      (value): AppDetails => {
        const result = record(value);
        const app = record(result.app);
        const capabilities = record(result.capabilities);
        let release: AppDetails["release"] = null;
        if (result.release !== undefined && result.release !== null) {
          const item = record(result.release);
          if (!Array.isArray(item.actions))
            throw new ApiError(
              "Action information is missing. Please try again.",
              "invalid_response",
              true,
            );
          release = {
            id: string(item.id),
            hash: string(item.hash),
            createdAt: timestamp(item.createdAt),
            actions: item.actions.map((value) => {
              const action = record(value);
              return {
                name: string(action.name),
                description: string(action.description),
                effect: string(action.effect),
              };
            }),
          };
        }
        return {
          app: {
            id: string(app.id),
            name: string(app.name),
            slug: string(app.slug),
            url: appUrl(app.url),
            status: string(app.status),
            audience: string(app.audience),
            workspaceId: string(app.workspaceId),
            activeReleaseId:
              app.activeReleaseId === null ? null : string(app.activeReleaseId),
          },
          capabilities: {
            canOpen: capabilities.canOpen === true,
            maintain: capabilities.maintain === true,
            manageAccess: capabilities.manageAccess === true,
            canManageMaintainers: capabilities.canManageMaintainers === true,
          },
          release,
        };
      },
      { signal },
    ),
  loginApp: (input: { appId: string; state: string; hostname: string }, key: string) =>
    operation(
      "apps.login",
      input,
      (value) => {
        const result = record(value);
        return { redirectUrl: appUrl(result.redirectUrl) };
      },
      { key },
    ),
  getDevice: (userCode: string, signal?: AbortSignal) =>
    operation(
      "auth.device.get",
      { userCode },
      (value) => {
        const result = record(value);
        return {
          clientName: string(result.clientName),
          agentLabel:
            typeof result.agentLabel === "string" ? result.agentLabel : null,
          expiresAt: timestamp(result.expiresAt),
          status: string(result.status),
        };
      },
      { signal },
    ),
  approveDevice: (
    input: { userCode: string; decision: "approve" | "deny" },
    key: string,
  ) =>
    operation(
      "auth.device.approve",
      input,
      (value): { status: "approved" | "denied" } => {
        const result = record(value);
        if (result.status !== "approved" && result.status !== "denied")
          throw new ApiError(
            "The request could not be resolved. Check the code and try again.",
            "device_not_resolved",
            false,
          );
        return { status: result.status };
      },
      { key },
    ),
};

export function isSignInRequired(error: unknown) {
  return error instanceof ApiError && error.code === "unauthorized";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function workspaceUrl(id: string): string {
  return `/workspace/?workspace=${encodeURIComponent(id)}`;
}

export function appOverviewUrl(id: string): string {
  return `/workspace/app/?appId=${encodeURIComponent(id)}`;
}

function appUrl(value: unknown): string {
  const text = string(value);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ApiError(
      "Atrax returned an invalid app address.",
      "invalid_response",
      false,
    );
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  )
    throw new ApiError(
      "Atrax returned an unsafe app address.",
      "invalid_response",
      false,
    );
  return url.href;
}

export function appStatus(status: string): string {
  return status === "ready"
    ? "Live"
    : status === "failed"
      ? "Deployment failed"
      : status === "deploying"
        ? "Deploying"
        : status === "deleted"
          ? "Deleted"
          : status === "created"
            ? "No deployment"
            : status;
}

export function audienceLabel(audience: string): string {
  return audience === "workspace"
    ? "Everyone in the workspace"
    : audience === "public"
      ? "Public"
      : "Selected people";
}

export function safeReturnTo(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/workspaces/";
  const destination = new URL(value, "https://atrax.run");
  if (
    destination.origin !== "https://atrax.run" ||
    ![
      "/workspaces",
      "/workspace",
      "/workspace/app",
      "/workspace/library",
      "/workspace/team",
      "/auth/device",
      "/auth/invite",
      "/auth/guest-invite",
      "/auth/app",
    ].some(
      (path) =>
        destination.pathname === path || destination.pathname === `${path}/`,
    )
  )
    return "/workspaces/";
  return `${destination.pathname}${destination.search}`;
}
