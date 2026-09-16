CREATE TABLE library_items (
  item_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  kind TEXT NOT NULL CHECK(kind IN ('knowledge','file')),
  status TEXT NOT NULL CHECK(status IN ('active','archived')),
  audience TEXT NOT NULL CHECK(audience IN ('workspace','selected')),
  current_revision_id TEXT,
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX library_items_workspace ON library_items(workspace_id,status,updated_at);
CREATE TABLE library_people (
  item_id TEXT NOT NULL REFERENCES library_items(item_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  PRIMARY KEY(item_id,person_id)
);
CREATE TABLE library_revisions (
  revision_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES library_items(item_id),
  revision_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_person_id TEXT NOT NULL REFERENCES people(person_id),
  author_session_id TEXT NOT NULL REFERENCES sessions(session_id),
  created_at INTEGER NOT NULL,
  indexing_status TEXT NOT NULL CHECK(indexing_status IN ('ready','stored_without_text')),
  UNIQUE(item_id,revision_number)
);
CREATE TABLE library_sources (
  revision_id TEXT NOT NULL REFERENCES library_revisions(revision_id),
  source_revision_id TEXT NOT NULL REFERENCES library_revisions(revision_id),
  PRIMARY KEY(revision_id,source_revision_id)
);
CREATE INDEX library_sources_source ON library_sources(source_revision_id);
CREATE TABLE library_operation_receipts (
  operation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  person_id TEXT NOT NULL REFERENCES people(person_id),
  operation_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  item_id TEXT NOT NULL,
  revision_id TEXT,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(person_id,operation_name,key_hash)
);
CREATE VIRTUAL TABLE library_search USING fts5(item_id UNINDEXED,title,body_text,tokenize='unicode61');

-- Reinvitation must not restore an old selected audience grant.
CREATE TRIGGER removed_member_library_access AFTER UPDATE OF status ON workspace_members
WHEN NEW.status='removed'
BEGIN
  DELETE FROM library_people WHERE person_id=NEW.person_id AND item_id IN (SELECT item_id FROM library_items WHERE workspace_id=NEW.workspace_id);
END;
