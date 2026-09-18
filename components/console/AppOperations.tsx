"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  errorMessage,
  type AppOperationsData,
  type DeploymentJob,
  type RestorePlan,
} from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import consoleStyles from "./console.module.css";
import styles from "./app-operations.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AppOperationsData };

type Notice =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type RollbackReview =
  | { kind: "idle" }
  | { kind: "ready"; release: AppOperationsData["releases"][number] };

type RestoreReview =
  | { kind: "idle" }
  | { kind: "loading"; backupId: string }
  | { kind: "error"; backupId: string; message: string }
  | { kind: "ready"; plan: RestorePlan };

type StatusTone = "good" | "progress" | "danger" | "quiet";

function shortId(value: string): string {
  return value.length > 24 ? value.slice(0, 8) : value;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(start: number, end: number): string {
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function deploymentLabel(status: string): string {
  if (status === "succeeded") return "Succeeded";
  if (status === "failed") return "Failed";
  if (status === "awaiting_verification") return "Ready to verify";
  if (status === "cancelled") return "Cancelled";
  if (status === "preparing") return "Preparing";
  return status.replaceAll("_", " ");
}

function deploymentTone(status: string): StatusTone {
  if (status === "succeeded") return "good";
  if (status === "failed") return "danger";
  if (status === "awaiting_verification" || status === "preparing")
    return "progress";
  return "quiet";
}

function deploymentKind(
  kind: AppOperationsData["deployments"][number]["kind"],
  mode: AppOperationsData["deployments"][number]["mode"],
): string {
  if (mode === "preview") return "Preview";
  if (kind === "rollback") return "Code rollback";
  if (kind === "restore") return "Database restore";
  return "Deployment";
}

function backupLabel(status: string): string {
  if (status === "succeeded") return "Snapshot ready";
  if (status === "failed") return "Snapshot failed";
  if (status === "cancelled") return "Snapshot cancelled";
  return "Capturing snapshot";
}

function isActive(status: string): boolean {
  return !["succeeded", "failed", "cancelled"].includes(status);
}

function recordedStatus({
  appStatus,
  activeReleaseId,
  latest,
}: {
  appStatus: string;
  activeReleaseId: string | null;
  latest: AppOperationsData["deployments"][number] | undefined;
}): { title: string; description: string; tone: StatusTone } {
  if (appStatus === "deleted")
    return {
      title: "App deleted",
      description: "This app no longer has an active deployment.",
      tone: "quiet",
    };
  if (latest && isActive(latest.status))
    return {
      title: activeReleaseId ? "Change in progress" : "First deployment in progress",
      description: activeReleaseId
        ? `Atrax still records release ${shortId(activeReleaseId)} as live while the new candidate is prepared.`
        : "Atrax is preparing the app's first candidate release.",
      tone: "progress",
    };
  if (latest?.status === "failed")
    return {
      title: activeReleaseId ? "Latest change failed" : "Deployment failed",
      description: activeReleaseId
        ? `Atrax still records release ${shortId(activeReleaseId)} as live. The failed attempt did not become the recorded live release.`
        : "No release has become live. Inspect the failure below, then deploy again from the project.",
      tone: "danger",
    };
  if (activeReleaseId && appStatus === "ready")
    return {
      title: "Live release configured",
      description: `Atrax records release ${shortId(activeReleaseId)} as live. This is deployment state, not an uptime check.`,
      tone: "good",
    };
  return {
    title: "Not deployed",
    description: "Deploy the project before anyone can open this app.",
    tone: "quiet",
  };
}

function CandidateControls({
  appId,
  deployment,
  pending,
  onMutate,
}: {
  appId: string;
  deployment: AppOperationsData["deployments"][number];
  pending: boolean;
  onMutate: (
    identity: string,
    pendingMessage: string,
    successMessage: string,
    action: (key: string) => Promise<DeploymentJob>,
  ) => Promise<void>;
}) {
  if (
    deployment.status !== "awaiting_verification" &&
    !(deployment.status === "failed" && deployment.error?.retryable)
  )
    return null;

  return (
    <div className={styles.candidate} aria-label="Deployment needs attention">
      <strong>
        {deployment.status === "awaiting_verification"
          ? "Candidate ready for your check"
          : "This deployment can be resumed"}
      </strong>
      {deployment.status === "awaiting_verification" && (
        <p className={consoleStyles.muted}>
          Open the private candidate, then verify it to finish the checks
          {deployment.mode === "preview" ? "." : " before making it live."}
        </p>
      )}
      {deployment.candidateUrl && (
        <a href={deployment.candidateUrl} target="_blank" rel="noreferrer">
          Open candidate
        </a>
      )}
      <div className={styles.rowActions}>
        {deployment.status === "awaiting_verification" ? (
          <button
            className={styles.dangerButton}
            type="button"
            disabled={pending}
            onClick={() =>
              void onMutate(
                `verify:${deployment.id}`,
                "Verifying the candidate…",
                deployment.mode === "preview"
                  ? "Preview verification accepted."
                  : "Verification accepted. Atrax is updating the live release.",
                (key) =>
                  api.verifyDeployment(
                    { appId, deploymentId: deployment.id },
                    key,
                  ),
              )
            }
          >
            {deployment.mode === "preview" ? "Verify preview" : "Verify and make live"}
          </button>
        ) : (
          <button
            className={styles.inlineButton}
            type="button"
            disabled={pending}
            onClick={() =>
              void onMutate(
                `resume-deployment:${deployment.id}`,
                "Resuming the deployment…",
                "Atrax resumed the deployment.",
                (key) =>
                  api.resumeDeployment(
                    { appId, deploymentId: deployment.id },
                    key,
                  ),
              )
            }
          >
            Resume deployment
          </button>
        )}
      </div>
    </div>
  );
}

export function AppOperations({
  appId,
  appStatus,
  activeReleaseId,
  onAppChanged,
}: {
  appId: string;
  appStatus: string;
  activeReleaseId: string | null;
  onAppChanged: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [rollbackReview, setRollbackReview] = useState<RollbackReview>({
    kind: "idle",
  });
  const [restoreReview, setRestoreReview] = useState<RestoreReview>({
    kind: "idle",
  });
  const [attempt, setAttempt] = useState(0);
  const writeAttempt = useRef<{ identity: string; key: string } | null>(null);
  const writeBusy = useRef(false);
  const notifiedAppState = useRef<string | null>(null);

  const acceptData = useCallback(
    (data: AppOperationsData) => {
      setState({ kind: "ready", data });
      const received = `${data.app.status}:${data.app.activeReleaseId ?? ""}`;
      const shown = `${appStatus}:${activeReleaseId ?? ""}`;
      if (received !== shown && notifiedAppState.current !== received) {
        notifiedAppState.current = received;
        onAppChanged();
      } else if (received === shown) notifiedAppState.current = null;
    },
    [activeReleaseId, appStatus, onAppChanged],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await api.getAppOperations(appId, signal);
        acceptData(data);
      } catch (error) {
        if (!signal?.aborted)
          setState({ kind: "error", message: errorMessage(error) });
      }
    },
    [acceptData, appId],
  );

  useEffect(() => {
    const controller = new AbortController();
    api.getAppOperations(appId, controller.signal).then(
      acceptData,
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [acceptData, appId, attempt]);

  const activeWork =
    state.kind === "ready" &&
    (state.data.deployments.some((deployment) => isActive(deployment.status)) ||
      state.data.backups.some((backup) => isActive(backup.status)));

  useEffect(() => {
    if (!activeWork) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 2500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeWork, load, state]);

  const latest =
    state.kind === "ready"
      ? state.data.deployments.find((deployment) => deployment.mode === "live")
      : undefined;
  const recordedApp = state.kind === "ready" ? state.data.app : { status: appStatus, activeReleaseId };
  const attentionDeployment =
    state.kind === "ready"
      ? state.data.deployments.find(
          (deployment) =>
            deployment.status === "awaiting_verification" ||
            (deployment.status === "failed" && deployment.error?.retryable),
        )
      : undefined;
  const status = useMemo(
    () =>
      recordedStatus({
        appStatus: recordedApp.status,
        activeReleaseId: recordedApp.activeReleaseId,
        latest,
      }),
    [latest, recordedApp.activeReleaseId, recordedApp.status],
  );
  const pending = notice.kind === "pending";

  async function refresh() {
    await load();
  }

  async function mutate(
    identity: string,
    pendingMessage: string,
    successMessage: string,
    action: (key: string) => Promise<DeploymentJob>,
  ) {
    if (writeBusy.current) return;
    writeBusy.current = true;
    if (writeAttempt.current?.identity !== identity)
      writeAttempt.current = { identity, key: crypto.randomUUID() };
    setNotice({ kind: "pending", message: pendingMessage });
    try {
      await action(writeAttempt.current.key);
      writeAttempt.current = null;
      setNotice({ kind: "success", message: successMessage });
      setRollbackReview({ kind: "idle" });
      setRestoreReview({ kind: "idle" });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      writeBusy.current = false;
    }
  }

  async function reviewRestore(backupId: string) {
    setRestoreReview({ kind: "loading", backupId });
    setNotice({ kind: "idle" });
    try {
      const plan = await api.planRestore(appId, backupId);
      setRestoreReview({ kind: "ready", plan });
    } catch (error) {
      setRestoreReview({
        kind: "error",
        backupId,
        message: errorMessage(error),
      });
    }
  }

  return (
    <section className={styles.section} aria-labelledby="operations-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="operations-heading">Operations</h2>
          <p className={consoleStyles.muted}>
            Recorded deployment state, action calls, and recovery.
          </p>
        </div>
        {state.kind === "ready" && (
          <button
            className={consoleStyles.secondary}
            type="button"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <>
          <div className={consoleStyles.skeleton} aria-hidden="true" />
          <p role="status">Loading operations…</p>
        </>
      )}

      {state.kind === "error" && (
        <>
          <ErrorNotice message={state.message} />
          <div className={consoleStyles.inlineNote}>
            <button
              className={consoleStyles.secondary}
              type="button"
              onClick={() => {
                setState({ kind: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        </>
      )}

      {state.kind === "ready" && (
        <>
          <div className={styles.statusBand}>
            <div className={styles.statusHeader}>
              <span
                className={styles.statusMark}
                data-tone={status.tone}
                aria-hidden="true"
              />
              <div className={styles.statusCopy}>
                <h3>{status.title}</h3>
                <p>{status.description}</p>
              </div>
            </div>
            <dl className={styles.statusFacts}>
              <div>
                <dt>Recorded live release</dt>
                <dd>
                  {recordedApp.activeReleaseId ? (
                    <code>{shortId(recordedApp.activeReleaseId)}</code>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt>Latest change</dt>
                <dd>{latest ? formatTime(latest.updatedAt) : "No deployment yet"}</dd>
              </div>
            </dl>
            {latest?.status === "failed" && latest.error && (
              <p className={styles.failure} role="alert">
                <strong>Latest failure:</strong> {latest.error.message}
              </p>
            )}
          </div>

          <section className={styles.usage} aria-labelledby="usage-heading">
            <div>
              <h3 id="usage-heading">Action calls</h3>
              <p>
                Recorded named actions in the past {state.data.usage.windowHours} hours.
                Page views and billing usage are not measured here.
              </p>
            </div>
            <dl className={styles.usageFacts}>
              <div>
                <dt>Total</dt>
                <dd>{state.data.usage.total}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{state.data.usage.failed}</dd>
              </div>
              <div>
                <dt>Interrupted</dt>
                <dd>{state.data.usage.interrupted}</dd>
              </div>
              {state.data.usage.running > 0 && (
                <div>
                  <dt>Running</dt>
                  <dd>{state.data.usage.running}</dd>
                </div>
              )}
            </dl>
            {state.data.usage.byAction.length > 0 && (
              <ul className={styles.actionUsage} aria-label="Calls by action">
                {state.data.usage.byAction.map((action) => (
                  <li key={action.actionName}>
                    <code>{action.actionName}</code>
                    <span>{action.total} calls</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {attentionDeployment && (
            <CandidateControls
              appId={appId}
              deployment={attentionDeployment}
              pending={pending}
              onMutate={mutate}
            />
          )}

          {notice.kind === "pending" && (
            <p className={consoleStyles.notice} role="status">
              {notice.message}
            </p>
          )}
          {notice.kind === "success" && (
            <p className={consoleStyles.success} role="status">
              {notice.message}
            </p>
          )}
          {notice.kind === "error" && <ErrorNotice message={notice.message} />}

          <section className={styles.history} aria-labelledby="deployment-history-heading">
            <h3 id="deployment-history-heading">Deployment history</h3>
            {state.data.deployments.length ? (
              <ol className={styles.historyList}>
                {state.data.deployments.map((deployment) => (
                  <li className={styles.historyItem} key={deployment.id}>
                    <details>
                      <summary>
                        <span className={styles.rowHeader}>
                          <span className={styles.rowMain}>
                            <strong>
                              {deploymentKind(deployment.kind, deployment.mode)}
                            </strong>
                            <small>
                              Release <code>{shortId(deployment.releaseId)}</code> by{" "}
                              {deployment.createdBy}
                            </small>
                          </span>
                          <span className={styles.rowMeta}>
                            <span
                              className={styles.chip}
                              data-tone={deploymentTone(deployment.status)}
                            >
                              {deploymentLabel(deployment.status)}
                            </span>
                            <br />
                            <time dateTime={new Date(deployment.createdAt).toISOString()}>
                              {formatTime(deployment.createdAt)}
                            </time>
                          </span>
                        </span>
                      </summary>
                      <dl className={styles.meta}>
                        <div>
                          <dt>Phase</dt>
                          <dd>{deployment.phase.replaceAll("_", " ")}</dd>
                        </div>
                        <div>
                          <dt>Duration so far</dt>
                          <dd>{formatDuration(deployment.createdAt, deployment.updatedAt)}</dd>
                        </div>
                        <div>
                          <dt>Deployment ID</dt>
                          <dd>
                            <code>{deployment.id}</code>
                          </dd>
                        </div>
                      </dl>
                      {deployment.error && (
                        <p className={styles.failure} role="alert">
                          {deployment.error.message}
                        </p>
                      )}
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>No deployment attempts have been recorded.</p>
            )}
          </section>

          <section className={styles.recovery} aria-labelledby="recovery-heading">
            <h3 id="recovery-heading">Recovery</h3>
            <div className={styles.recoveryGrid}>
              <div className={styles.recoveryGroup}>
                <div className={styles.recoveryHeader}>
                  <div>
                    <h3>Roll back code</h3>
                    <p className={styles.recoveryCopy}>
                      Replaces the live release. Business data and additive schema stay
                      in place.
                    </p>
                  </div>
                </div>
                {state.data.releases.some((release) => release.rollbackEligible) ? (
                  <ul className={styles.releaseList}>
                    {state.data.releases
                      .filter((release) => release.rollbackEligible)
                      .map((release) => (
                        <li className={styles.releaseItem} key={release.id}>
                          <div className={styles.rowHeader}>
                            <span className={styles.rowMain}>
                              <code>{shortId(release.id)}</code>
                              <small>
                                {formatTime(release.createdAt)} by {release.createdBy}
                              </small>
                            </span>
                            <button
                              className={styles.inlineButton}
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setRestoreReview({ kind: "idle" });
                                setRollbackReview({ kind: "ready", release });
                                setNotice({ kind: "idle" });
                              }}
                            >
                              Review
                            </button>
                          </div>
                          {rollbackReview.kind === "ready" &&
                            rollbackReview.release.id === release.id && (
                              <div className={styles.review}>
                                <strong>Roll back to {shortId(release.id)}?</strong>
                                <p>
                                  This changes live code after candidate verification. It
                                  does not restore earlier business data.
                                </p>
                                <div className={styles.reviewActions}>
                                  <button
                                    className={styles.dangerButton}
                                    type="button"
                                    disabled={pending || !recordedApp.activeReleaseId}
                                    onClick={() => {
                                      const expectedReleaseId =
                                        recordedApp.activeReleaseId;
                                      if (!expectedReleaseId) return;
                                      void mutate(
                                        `rollback:${appId}:${release.id}:${expectedReleaseId}`,
                                        "Starting the code rollback…",
                                        "Rollback candidate started. Atrax will ask you to verify it before it becomes live.",
                                        (key) =>
                                          api.rollbackApp(
                                            {
                                              appId,
                                              releaseId: release.id,
                                              expectedReleaseId,
                                            },
                                            key,
                                          ),
                                      );
                                    }}
                                  >
                                    Roll back code
                                  </button>
                                  <button
                                    className={styles.inlineButton}
                                    type="button"
                                    onClick={() => setRollbackReview({ kind: "idle" })}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>
                    No earlier live release is available for code rollback.
                  </p>
                )}
              </div>

              <div className={styles.recoveryGroup}>
                <div className={styles.recoveryHeader}>
                  <div>
                    <h3>Restore business data</h3>
                    <p className={styles.recoveryCopy}>
                      Starts from an immutable snapshot in a new database. The current
                      database is retained separately.
                    </p>
                  </div>
                  {state.data.database.present && recordedApp.activeReleaseId && (
                    <button
                      className={styles.inlineButton}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const expectedReleaseId = recordedApp.activeReleaseId;
                        if (!expectedReleaseId) return;
                        void mutate(
                          `backup:${appId}:${expectedReleaseId}`,
                          "Starting the snapshot…",
                          "Snapshot started. Atrax will update its status here.",
                          (key) =>
                            api.createBackup(
                              { appId, expectedReleaseId },
                              key,
                            ),
                        );
                      }}
                    >
                      New snapshot
                    </button>
                  )}
                </div>
                {!state.data.database.present ? (
                  <p className={styles.empty}>This app has no database to snapshot.</p>
                ) : state.data.backups.length ? (
                  <ul className={styles.backupList}>
                    {state.data.backups.map((backup) => (
                      <li className={styles.backupItem} key={backup.id}>
                        <div className={styles.rowHeader}>
                          <span className={styles.rowMain}>
                            <strong>{backupLabel(backup.status)}</strong>
                            <small>
                              {backup.snapshotCreatedAt
                                ? formatTime(backup.snapshotCreatedAt)
                                : formatTime(backup.createdAt)}
                              {backup.size !== null ? ` · ${formatBytes(backup.size)}` : ""}
                            </small>
                          </span>
                          <span
                            className={styles.chip}
                            data-tone={deploymentTone(backup.status)}
                          >
                            {deploymentLabel(backup.status)}
                          </span>
                        </div>
                        <div className={styles.rowActions}>
                          {backup.status === "succeeded" && (
                            <button
                              className={styles.inlineButton}
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setRollbackReview({ kind: "idle" });
                                void reviewRestore(backup.id);
                              }}
                            >
                              Review restore
                            </button>
                          )}
                          {backup.status === "failed" && backup.error?.retryable && (
                            <button
                              className={styles.inlineButton}
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                void mutate(
                                  `resume-backup:${appId}:${backup.id}`,
                                  "Resuming the snapshot…",
                                  "Snapshot resumed.",
                                  (key) =>
                                    api.resumeBackup(
                                      { appId, backupId: backup.id },
                                      key,
                                    ),
                                )
                              }
                            >
                              Resume snapshot
                            </button>
                          )}
                        </div>
                        {backup.error && (
                          <p className={styles.failure} role="alert">
                            {backup.error.message}
                          </p>
                        )}
                        {restoreReview.kind === "loading" &&
                          restoreReview.backupId === backup.id && (
                            <p role="status">Loading restore impact…</p>
                          )}
                        {restoreReview.kind === "error" &&
                          restoreReview.backupId === backup.id && (
                            <ErrorNotice message={restoreReview.message} />
                          )}
                        {restoreReview.kind === "ready" &&
                          restoreReview.plan.backupId === backup.id && (
                            <div className={styles.review}>
                              <strong>
                                Restore the snapshot from{" "}
                                {formatTime(restoreReview.plan.snapshotCreatedAt)}?
                              </strong>
                              <p>{restoreReview.plan.warning}</p>
                              <p>
                                The restored app uses the snapshot&apos;s matching release.
                                {restoreReview.plan.connectedAppIds.length
                                  ? ` ${restoreReview.plan.connectedAppIds.length} connected ${restoreReview.plan.connectedAppIds.length === 1 ? "app keeps" : "apps keep"} its own data.`
                                  : " No connected apps are affected."}
                              </p>
                              <div className={styles.reviewActions}>
                                <button
                                  className={styles.dangerButton}
                                  type="button"
                                  disabled={pending}
                                  onClick={() => {
                                    const plan = restoreReview.plan;
                                    void mutate(
                                      `restore:${appId}:${plan.backupId}:${plan.expectedReleaseId}:${plan.snapshotCreatedAt}`,
                                      "Starting the database restore…",
                                      "Restore candidate started. Atrax will ask you to verify it before it becomes live.",
                                      (key) =>
                                        api.startRestore(
                                          {
                                            appId,
                                            backupId: plan.backupId,
                                            expectedReleaseId: plan.expectedReleaseId,
                                            confirmation: {
                                              originalDatabaseId: plan.originalDatabaseId,
                                              snapshotCreatedAt: plan.snapshotCreatedAt,
                                              connectedAppIds: plan.connectedAppIds,
                                              retainOriginalDatabase: true,
                                            },
                                          },
                                          key,
                                        ),
                                    );
                                  }}
                                >
                                  Start database restore
                                </button>
                                <button
                                  className={styles.inlineButton}
                                  type="button"
                                  onClick={() => setRestoreReview({ kind: "idle" })}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>No database snapshots have been created.</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
