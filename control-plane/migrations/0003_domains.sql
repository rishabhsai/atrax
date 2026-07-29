-- The custom domain an app answers on, and the Workers domain record that
-- attached it. Both stay NULL when the attach did not happen, which is what
-- tells teardown there is nothing to detach and leaves the app on workers.dev.
ALTER TABLE apps ADD COLUMN hostname TEXT;

ALTER TABLE apps ADD COLUMN domain_id TEXT;
