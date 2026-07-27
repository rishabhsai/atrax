CREATE TABLE IF NOT EXISTS apps (
  app_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  url TEXT NOT NULL,
  d1_id TEXT NOT NULL,
  d1_name TEXT NOT NULL,
  applied_migrations TEXT NOT NULL,
  claim_hash TEXT NOT NULL,
  manage_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  expires_at INTEGER,
  last_deploy_at INTEGER
);

CREATE INDEX IF NOT EXISTS apps_claim_hash ON apps (claim_hash);

CREATE INDEX IF NOT EXISTS apps_expiry ON apps (expires_at);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, day)
);
