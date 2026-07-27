CREATE TABLE IF NOT EXISTS door_members (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  invite_hash TEXT,
  invite_expires_at INTEGER,
  joined_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS door_members_invite_hash
ON door_members (invite_hash);
