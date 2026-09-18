# App operations

Inspect deployments and recover code or data, with availability for the upcoming console.

## Release availability

The CLI operations for inspecting deployments, rolling back code, capturing snapshots, and restoring data are available in the current release.

The consolidated App operations console and apps.operations.get are implemented in the 0.3.0 source candidate. They are awaiting hosted rollout. The console and recorded action-count descriptions below apply to that upcoming release.

## Find the app and its current release

Use an app maintainer session. Opening an app as a member or guest does not grant permission to inspect deployment records or perform recovery.

Read the app ID from the workspace or the app lockfile. Inspect the app and its releases before choosing a recovery target. Keep the observed active release ID for operations that require expectedReleaseId.

```
atrax call apps.get --input '{"appId":"APP_ID"}' --json
atrax call releases.list --input '{"appId":"APP_ID"}' --json
atrax call backups.list --input '{"appId":"APP_ID"}' --json
```

## Inspect a deployment

Read the deployment ID returned by deploy or a recovery operation. deployments.get reports its status, phase, error, and cleanup progress. Preparation is not publication.

At awaiting_verification, the candidate is private. deployments.verify checks that candidate using your current session and attempts promotion. Report the update as complete only when the deployment reports succeeded.

If a provider response is uncertain, inspect the job before taking another action. A timeout does not establish whether the provider changed a resource. Run atrax deploy again to resume a saved CLI attempt.

```
atrax call deployments.get --input '{"appId":"APP_ID","deploymentId":"DEPLOYMENT_ID"}' --json

# Use this once the deployment is awaiting_verification.
atrax call deployments.verify --key verify-reviewed-candidate-v1 --input '{"appId":"APP_ID","deploymentId":"DEPLOYMENT_ID"}' --json
```

## Roll back code while retaining data

Choose a previously deployed release and inspect deployments.plan. Code rollback keeps business records and compatible additive schema. It does not restore the database to the date of that release.

Submit deployments.rollback with the target release and the observed current release. Follow the returned deployment through preparation, verification, and completion.

If another deployment changes the live release, refresh the app state and review the target again. Do not substitute a new expectedReleaseId without checking what changed.

```
atrax call deployments.plan --input '{"appId":"APP_ID","releaseId":"TARGET_RELEASE_ID","expectedReleaseId":"CURRENT_RELEASE_ID"}' --json
atrax call deployments.rollback --key rollback-reviewed-release-v1 --input '{"appId":"APP_ID","releaseId":"TARGET_RELEASE_ID","expectedReleaseId":"CURRENT_RELEASE_ID"}' --json
```

## Capture a database snapshot

Create a snapshot when you need a recovery point for an app with a database. The capture refers to the observed release. D1 pauses queries while it exports the database.

Read the returned backup ID and inspect backups.get until capture completes. If capture is interrupted, use backups.resume with that ID. The snapshot timestamp and completed status establish what data is available for a restore.

```
atrax call backups.create --key snapshot-before-change-v1 --input '{"appId":"APP_ID","expectedReleaseId":"CURRENT_RELEASE_ID"}' --json
atrax call backups.get --input '{"appId":"APP_ID","backupId":"BACKUP_ID"}' --json
```

## Restore data into a new database

Inspect data.restore.plan for the chosen snapshot. Review its capture time, original database, matching release, and connected apps before deciding to proceed.

data.restore.start requires the expected live release and explicit confirmation of the original database ID, snapshot timestamp, connected app IDs, and retention of the original database. Use the observed values from the plan.

Restore prepares a new database and matching code for verification. The original database and its later writes are retained. Restoring Inventory does not rewind Orders or any other connected app. Review those records before publishing the restored candidate.

```
atrax call data.restore.plan --input '{"appId":"APP_ID","backupId":"BACKUP_ID"}' --json
atrax operations inspect data.restore.start --json
```

Code rollback and data restore are separate decisions. A restore plan does not change the live app. After a successful rollback or restore, review the new live release and run atrax link APP_ID in your checkout before the next ordinary deployment.

## Read the upcoming App operations console

After rollout, open an app in the workspace to see its deployment state, release history, failed attempts, snapshots, and recorded action calls. apps.operations.get provides the same summary for CLI and MCP clients.

The summary contains the 10 most recent deployments, 10 most recent releases, and 5 most recent snapshots. Use the corresponding list or get operation when investigating beyond this summary.

```
atrax call apps.operations.get --input '{"appId":"APP_ID"}' --json
```

## Interpret recorded action counts

The upcoming summary counts recorded action invocations in the last 24 hours, including previews. It separates succeeded, failed, running, and interrupted calls, both overall and by action name.

Interrupted means the invocation expired without a recorded completion. It does not prove that the action made no business change. Inspect the business record and retry with the original key when the action supports that recovery.

These counts are not HTTP request totals, billed usage, or an uptime measurement. An empty count is not proof that an app is unavailable.
