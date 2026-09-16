-- The publication record and initial grants commit in the same database batch.
-- A lost response must not apply those grants again after a policy edit.
ALTER TABLE deployments ADD COLUMN recorded_at INTEGER;
