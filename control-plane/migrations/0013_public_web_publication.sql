-- Public web hosting and the employee audience are independent permissions.
ALTER TABLE apps ADD COLUMN public_web INTEGER NOT NULL DEFAULT 0 CHECK(public_web IN (0,1));
ALTER TABLE apps ADD COLUMN public_revision INTEGER NOT NULL DEFAULT 0;

-- Preserve the effective permissions of any earlier published workspace app.
UPDATE apps SET public_web=1,public_revision=1,audience='workspace' WHERE audience='public';
