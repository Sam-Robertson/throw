-- Memberships with no studio belong to Provo for now (Sam, 2026-09-12). This
-- covers the Momence imports, almost none of which carried a location.
-- Provo is identified by the postal code the launch-sept-2026 migration
-- backfilled; if no such location exists (e.g. a fresh database) this is a no-op.
UPDATE "Membership"
SET "locationId" = (
  SELECT "id" FROM "Location" WHERE "postalCode" = '84606' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "locationId" IS NULL
  AND EXISTS (SELECT 1 FROM "Location" WHERE "postalCode" = '84606');
