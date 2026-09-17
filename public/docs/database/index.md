# Database

Persistent structured data for each app.

## Own the records

Each stateful app owns its database. Other apps use its named actions. Local and hosted migrations retain checksums and refuse a changed or missing applied migration.

## Migration and recovery

Initial setup accepts numbered SQL or JSON migrations. Changes to a live database use numbered JSON migrations that create new tables or nonunique indexes. Existing columns, constraints, and records stay intact. Applied migration files are immutable; their names and checksums are checked against the actual database ledger.

Inspect deployments.plan before changing a live release. deployments.rollback changes code while retaining business data and compatible additive schema. Changing an existing data model requires a deliberate data migration; arbitrary SQL changes to live tables are not part of this launch.

```
{"version":1,"operations":[{"createTable":{"name":"notes","columns":[{"name":"id","type":"TEXT","primaryKey":true},{"name":"body","type":"TEXT","notNull":true}]}}]}
```

## Snapshots and restore

backups.create captures an immutable SQL snapshot. Cloudflare D1 pauses database queries during export; inspect backups.get until capture completes. An interrupted capture can continue through backups.resume.

data.restore.plan shows the snapshot, original database, and connected apps. data.restore.start requires confirmation of those details and restores into a new database. Verify that deployment before publication. The original database and later writes remain retained. Restoring one app does not rewind records owned by another app.

```
atrax call backups.create --key monthly-snapshot --input '{"appId":"APP_ID","expectedReleaseId":"RELEASE_ID"}' --json
atrax call data.restore.plan --input '{"appId":"APP_ID","backupId":"BACKUP_ID"}' --json
```

## Isolated previews

previews.create runs a release against a separate database initialized from its migrations. Copying an existing backup requires explicit authorization. Preview actions require current maintainer access; previews receive no live app dependencies or Library access.

When finished, call previews.delete with confirmation: delete-preview. Access closes immediately and resource cleanup continues durably. Ordinary deployment candidates are also reclaimed after completion or cancellation. deployments.get reports cleanup progress; uncertain provider writes retain affected resources with an explanation rather than risk deleting a resource still in use.

## Business idempotency

Use a stable business command key and commit its receipt in the same transaction as its data change. The platform records invocation identity; it cannot deduplicate arbitrary application side effects for the app.
