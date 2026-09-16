CREATE TABLE people (
  person_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  verified_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  person_id TEXT NOT NULL REFERENCES people(person_id),
  kind TEXT NOT NULL CHECK (kind IN ('browser', 'cli', 'agent', 'app')),
  agent_label TEXT,
  parent_session_id TEXT REFERENCES sessions(session_id),
  app_id TEXT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_person ON sessions(person_id);

CREATE TABLE email_challenges (
  challenge_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose = 'sign_in'),
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE identity_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE device_authorizations (
  device_id TEXT PRIMARY KEY,
  device_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  agent_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'consumed')),
  person_id TEXT REFERENCES people(person_id),
  approving_session_id TEXT REFERENCES sessions(session_id),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE workspaces (
  workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('active', 'removed')),
  joined_at INTEGER NOT NULL,
  removed_at INTEGER,
  PRIMARY KEY (workspace_id, person_id)
);
CREATE INDEX workspace_members_person ON workspace_members(person_id, status);

CREATE TABLE invitations (
  invitation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at INTEGER NOT NULL,
  accepted_by TEXT REFERENCES people(person_id),
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE UNIQUE INDEX invitations_pending ON invitations(workspace_id, email) WHERE status = 'pending';
CREATE INDEX invitations_email ON invitations(email, status);

CREATE TABLE workspace_operation_receipts (
  operation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(person_id),
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  operation_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (person_id, operation_name, key_hash)
);
