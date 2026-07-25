CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 40),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_created_at
ON messages (created_at, id);
