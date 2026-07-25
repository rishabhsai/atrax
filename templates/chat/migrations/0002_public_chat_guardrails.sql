CREATE TABLE IF NOT EXISTS message_rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 1)
);

CREATE INDEX IF NOT EXISTS message_rate_limits_window_start
ON message_rate_limits (window_start);
