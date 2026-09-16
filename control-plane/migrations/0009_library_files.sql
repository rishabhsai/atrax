CREATE TABLE library_file_versions (
  revision_id TEXT PRIMARY KEY REFERENCES library_revisions(revision_id),
  item_id TEXT NOT NULL REFERENCES library_items(item_id),
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0 AND byte_size <= 10485760),
  sha256 TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL
);
CREATE INDEX library_files_item ON library_file_versions(item_id,uploaded_at);
