-- Migrate an existing User row to a Keycloak subject (sub) as primary key.
-- Preserves tickets, comments, attachments, schedules, and calendar notes.
--
-- Replace placeholders before running:
--   :old_id     — current Quicket User.id (guest/local row)
--   :new_id     — Keycloak sub UUID
--   :email      — canonical login email
--   :target_role — ADMIN | USER | GUEST (typically USER or ADMIN for SSO)

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE id = :'new_id') THEN
    RAISE EXCEPTION 'User with Keycloak id % already exists', :'new_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = :'old_id') THEN
    RAISE EXCEPTION 'Source user % not found', :'old_id';
  END IF;
END $guard$;

CREATE TEMP TABLE _keycloak_migrate_src ON COMMIT DROP AS
  SELECT * FROM "User" WHERE id = :'old_id';

UPDATE "User"
SET
  email = email || '.legacy-' || :'old_id',
  "magicToken" = NULL,
  "magicTokenExp" = NULL
WHERE id = :'old_id';

INSERT INTO "User" (
  id, email, name, password, role, department,
  "isKeycloakUser", "isActive", "isSystem",
  "magicToken", "magicTokenExp", "createdAt", "updatedAt"
)
SELECT
  :'new_id',
  :'email',
  name,
  NULL,
  :'target_role'::"Role",
  department,
  true,
  true,
  false,
  "magicToken",
  "magicTokenExp",
  "createdAt",
  now()
FROM _keycloak_migrate_src;

UPDATE "Ticket" SET "createdById" = :'new_id' WHERE "createdById" = :'old_id';
UPDATE "Ticket" SET "assignedToId" = :'new_id' WHERE "assignedToId" = :'old_id';
UPDATE "Comment" SET "userId" = :'new_id' WHERE "userId" = :'old_id';
UPDATE "Attachment" SET "uploadedById" = :'new_id' WHERE "uploadedById" = :'old_id';
UPDATE "Schedule" SET "createdById" = :'new_id' WHERE "createdById" = :'old_id';
UPDATE "Schedule" SET "assignedToId" = :'new_id' WHERE "assignedToId" = :'old_id';
UPDATE "CalendarNote" SET "createdById" = :'new_id' WHERE "createdById" = :'old_id';

DELETE FROM "User" WHERE id = :'old_id';

COMMIT;
