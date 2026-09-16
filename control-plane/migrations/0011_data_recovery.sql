ALTER TABLE apps ADD COLUMN schema_release_id TEXT REFERENCES releases(release_id);
UPDATE apps SET schema_release_id=active_release_id;
CREATE TABLE app_backups (
  backup_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  release_id TEXT NOT NULL REFERENCES releases(release_id),
  database_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  status TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE database_forks (
  deployment_id TEXT PRIMARY KEY REFERENCES deployments(deployment_id),
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  original_database_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  backup_id TEXT NOT NULL REFERENCES app_backups(backup_id),
  created_at INTEGER NOT NULL
);
