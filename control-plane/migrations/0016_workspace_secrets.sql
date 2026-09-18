ALTER TABLE invocations ADD COLUMN environment TEXT NOT NULL DEFAULT 'preview' CHECK(environment IN ('live','preview'));
CREATE TABLE workspace_secrets (
  secret_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','revoked')),
  revision INTEGER NOT NULL CHECK(revision > 0),
  ciphertext TEXT,
  iv TEXT,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK((status='active' AND ciphertext IS NOT NULL AND iv IS NOT NULL) OR (status='revoked' AND ciphertext IS NULL AND iv IS NULL))
);
CREATE INDEX workspace_secrets_workspace ON workspace_secrets(workspace_id,updated_at);
CREATE TABLE secret_app_grants (
  secret_id TEXT NOT NULL REFERENCES workspace_secrets(secret_id),
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  binding_name TEXT NOT NULL,
  PRIMARY KEY(app_id,binding_name),
  UNIQUE(secret_id,app_id)
);
CREATE TABLE secret_operation_receipts (
  operation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  operation_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  input_mac TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(person_id,operation_name,key_hash)
);
