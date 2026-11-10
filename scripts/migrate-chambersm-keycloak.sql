-- One-shot: chambersm guest → Keycloak sub (2026-11-10 prod)
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE id = '2add8a29-2d76-453d-9840-7ef1c7cbd681') THEN
    RAISE EXCEPTION 'Keycloak user id already exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = 'e7716341-c48d-4be7-a120-3b7049c871a6') THEN
    RAISE EXCEPTION 'Source guest user not found';
  END IF;
END $$;

CREATE TEMP TABLE _keycloak_migrate_src ON COMMIT DROP AS
  SELECT *
  FROM "User"
  WHERE id = 'e7716341-c48d-4be7-a120-3b7049c871a6';

UPDATE "User"
SET
  email = email || '.legacy-e7716341-c48d-4be7-a120-3b7049c871a6',
  "magicToken" = NULL,
  "magicTokenExp" = NULL
WHERE id = 'e7716341-c48d-4be7-a120-3b7049c871a6';

INSERT INTO "User" (
  id, email, name, password, role, department,
  "isKeycloakUser", "isActive", "isSystem",
  "magicToken", "magicTokenExp", "createdAt", "updatedAt"
)
SELECT
  '2add8a29-2d76-453d-9840-7ef1c7cbd681',
  'michael.chambers@parsons.us',
  name,
  NULL,
  'ADMIN'::"Role",
  department,
  true,
  true,
  false,
  "magicToken",
  "magicTokenExp",
  "createdAt",
  now()
FROM _keycloak_migrate_src;

UPDATE "Ticket" SET "createdById" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "createdById" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "Ticket" SET "assignedToId" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "assignedToId" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "Comment" SET "userId" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "userId" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "Attachment" SET "uploadedById" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "uploadedById" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "Schedule" SET "createdById" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "createdById" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "Schedule" SET "assignedToId" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "assignedToId" = 'e7716341-c48d-4be7-a120-3b7049c871a6';
UPDATE "CalendarNote" SET "createdById" = '2add8a29-2d76-453d-9840-7ef1c7cbd681' WHERE "createdById" = 'e7716341-c48d-4be7-a120-3b7049c871a6';

DELETE FROM "User" WHERE id = 'e7716341-c48d-4be7-a120-3b7049c871a6';

COMMIT;
