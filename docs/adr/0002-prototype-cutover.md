# ADR 0002: Retire the unused prototype for a fresh launch

- Status: Accepted; supersedes the temporary preservation decision
- Date: 2026-09-16

## Context

One claimed prototype remained: app `468132b487`, Worker `i-468132b487`,
and D1 database `54e33fc8-884f-4420-a9d9-f19b20ccf6d4`. A verified export
contained one message, one rate-limit row, and no Door members.

The owner confirmed that nobody had used the platform and authorized deletion.
Backward compatibility and porting this prototype are not launch requirements.

## Decision

Delete the unused Worker and database. Migration `0014_retire_prototype.sql`
removes the prototype control-plane table after the existing immutable migration
history has advanced to the workspace model. The public API and app contract are
v2 only; no legacy authentication, migration-hash invention, or adoption path is
introduced.

The earlier local export was a verification artifact, not a continuing hosting
or compatibility obligation. Production cutover can proceed after the workspace
launch checks pass.
