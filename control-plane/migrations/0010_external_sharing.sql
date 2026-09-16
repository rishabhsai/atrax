CREATE TABLE app_guest_invitations (
  invitation_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  email TEXT NOT NULL,
  action_names_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','revoked')),
  expires_at INTEGER NOT NULL,
  accepted_by TEXT REFERENCES people(person_id),
  created_by TEXT NOT NULL REFERENCES people(person_id),
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE UNIQUE INDEX app_guest_pending_email ON app_guest_invitations(app_id,email) WHERE status='pending';
CREATE TABLE app_guest_actions (
  app_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  PRIMARY KEY(app_id,person_id,action_name),
  FOREIGN KEY(app_id,person_id) REFERENCES app_guests(app_id,person_id) ON DELETE CASCADE,
  FOREIGN KEY(app_id,action_name) REFERENCES action_policies(app_id,action_name)
);
CREATE TRIGGER removed_member_guest_access AFTER UPDATE OF status ON workspace_members
WHEN NEW.status='removed'
BEGIN
  DELETE FROM app_guests WHERE person_id=NEW.person_id AND app_id IN (SELECT app_id FROM apps WHERE workspace_id=NEW.workspace_id);
  UPDATE app_guest_invitations SET status='revoked' WHERE status IN ('pending','accepted')
    AND app_id IN (SELECT app_id FROM apps WHERE workspace_id=NEW.workspace_id)
    AND email=(SELECT email FROM people WHERE person_id=NEW.person_id);
END;
