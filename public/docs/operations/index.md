# App operations

Inspect deployments, action calls, and recovery options.

## Inspect the app

Open an app from your workspace to inspect its deployment status, release history, failed deployments, and database snapshots. Maintainers can inspect these records through apps.operations.get too.

Action usage shows recorded calls during the last 24 hours, including previews. It separates successful, failed, running, and interrupted calls. An interrupted call expired without a recorded completion. These counts are not HTTP request totals, billed usage, or a measured uptime check.

```
atrax call apps.operations.get --input '{"appId":"<app-id>"}' --json
```

## Recover code

Choose a previously deployed release for code rollback. Atrax retains business data and compatible additive schema. Preparation creates a private candidate; verification must succeed before it becomes live. If another deployment changes the live release, inspect the new state before trying again.

The console exposes preparation, verification, retry, and completion separately. Through the CLI or MCP, inspect deployments.get, call deployments.verify at awaiting_verification, and report completion only after succeeded.

## Recover data

Create a database snapshot before changes that need a recovery point. D1 pauses queries while exporting. Snapshot capture can be resumed after an interruption.

A data restore creates a new database from a snapshot and retains the original database. Review the capture time and connected apps, then explicitly confirm the restore plan. Connected apps may hold newer records; their data is not rewound. Code rollback and data restore are separate decisions.
