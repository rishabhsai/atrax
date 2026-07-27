-- Records that a shared app's DOOR_SESSION_SECRET was generated and handed to
-- Cloudflare. The secret itself is never stored: this marker is what stops a
-- redeploy from rotating it out from under live sessions and open invites.
-- It doubles as the "this app is shared" flag every member endpoint checks.
ALTER TABLE apps ADD COLUMN door_secret_set INTEGER;
