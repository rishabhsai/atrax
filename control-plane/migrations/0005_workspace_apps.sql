-- Preserve prototype records for an explicit, verified adoption process.
-- This migration changes control-plane records only; it never deletes hosted data.
ALTER TABLE apps RENAME TO legacy_apps;
CREATE TABLE apps (
  app_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  gateway_name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('created','deploying','ready','failed','deleted')),
  audience TEXT NOT NULL DEFAULT 'workspace' CHECK(audience IN ('workspace','selected','public')),
  active_release_id TEXT,
  database_id TEXT,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id,slug)
);
CREATE TABLE app_maintainers (
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  PRIMARY KEY(app_id,person_id)
);
CREATE TABLE app_people (
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  PRIMARY KEY(app_id,person_id)
);
CREATE TABLE app_guests (
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  expires_at INTEGER,
  PRIMARY KEY(app_id,person_id)
);
CREATE TABLE action_policies (
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  action_name TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'workspace' CHECK(audience IN ('workspace','selected','public')),
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(app_id,action_name)
);
CREATE TABLE action_people (
  app_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(person_id),
  PRIMARY KEY(app_id,action_name,person_id),
  FOREIGN KEY(app_id,action_name) REFERENCES action_policies(app_id,action_name)
);
CREATE TABLE action_denials (
  app_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(person_id),
  PRIMARY KEY(app_id,action_name,person_id),
  FOREIGN KEY(app_id,action_name) REFERENCES action_policies(app_id,action_name)
);
CREATE TABLE releases (
  release_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  artifact_hash TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  runtime_name TEXT,
  manifest_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  migrations_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  UNIQUE(app_id,artifact_hash)
);
CREATE TABLE invocations (
  invocation_id TEXT PRIMARY KEY,
  root_invocation_id TEXT NOT NULL,
  parent_invocation_id TEXT REFERENCES invocations(invocation_id),
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  release_id TEXT NOT NULL REFERENCES releases(release_id),
  source_app_id TEXT REFERENCES apps(app_id),
  action_name TEXT NOT NULL,
  idempotency_key TEXT,
  depth INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
  error_code TEXT,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX invocations_workspace_activity ON invocations(app_id,started_at);
CREATE TABLE activity (
  activity_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  person_id TEXT REFERENCES people(person_id),
  session_id TEXT REFERENCES sessions(session_id),
  operation TEXT NOT NULL,
  target_id TEXT,
  outcome TEXT NOT NULL,
  details_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX activity_workspace_time ON activity(workspace_id,created_at);
CREATE TABLE operation_receipts (
  operation_id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(person_id),
  operation TEXT NOT NULL,
  target_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(person_id,operation,target_id,idempotency_key)
);
CREATE TABLE app_login_codes (
  code_hash TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  state_hash TEXT NOT NULL,
  callback TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE TRIGGER removed_member_maintenance AFTER UPDATE OF status ON workspace_members
WHEN NEW.status='removed'
BEGIN
  DELETE FROM app_maintainers WHERE person_id=NEW.person_id AND app_id IN (SELECT app_id FROM apps WHERE workspace_id=NEW.workspace_id);
  DELETE FROM app_people WHERE person_id=NEW.person_id AND app_id IN (SELECT app_id FROM apps WHERE workspace_id=NEW.workspace_id);
  DELETE FROM action_people WHERE person_id=NEW.person_id AND app_id IN (SELECT app_id FROM apps WHERE workspace_id=NEW.workspace_id);
END;
