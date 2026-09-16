CREATE TABLE app_hosts (
  hostname TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  release_id TEXT REFERENCES releases(release_id),
  kind TEXT NOT NULL CHECK(kind IN ('live','candidate','preview')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT INTO app_hosts(hostname,app_id,release_id,kind) SELECT replace(replace(url,'https://',''),'http://',''),app_id,active_release_id,'live' FROM apps;
CREATE TABLE deployments (
  deployment_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  release_id TEXT NOT NULL REFERENCES releases(release_id),
  created_by TEXT NOT NULL REFERENCES people(person_id),
  expected_release_id TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('live','preview')),
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX deployments_app_time ON deployments(app_id,created_at);
