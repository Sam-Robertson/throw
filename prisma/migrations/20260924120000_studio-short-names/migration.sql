-- Studios are called by their city: "Provo" and "Lehi", not "Throw Art Studio"
-- and "Throw Art Studio - Lehi". Data only; no schema change.

-- The class waivers backfilled by waivers-and-kinds were named after the
-- studio ("<studio name> waiver"); rename those too, before the studios.
UPDATE "Waiver" w
SET "name" = 'Provo waiver'
FROM "Location" l
WHERE w."locationId" = l."id" AND l."name" = 'Throw Art Studio'
  AND w."name" = 'Throw Art Studio waiver';

UPDATE "Waiver" w
SET "name" = 'Lehi waiver'
FROM "Location" l
WHERE w."locationId" = l."id" AND l."name" = 'Throw Art Studio - Lehi'
  AND w."name" = 'Throw Art Studio - Lehi waiver';

UPDATE "Location" SET "name" = 'Provo' WHERE "name" = 'Throw Art Studio';
UPDATE "Location" SET "name" = 'Lehi'  WHERE "name" = 'Throw Art Studio - Lehi';
