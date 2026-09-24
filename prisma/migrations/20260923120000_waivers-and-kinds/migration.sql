-- Waivers become documents (class, membership, other; per studio or every
-- studio) with versions, instead of one text per studio. Existing versions
-- are kept and grouped into one CLASS waiver per studio, so every signature
-- stays attached to exactly the text it was signed against.

-- CreateTable
CREATE TABLE "Waiver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CLASS',
    "locationId" TEXT,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waiver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Waiver_kind_locationId_idx" ON "Waiver"("kind", "locationId");

-- AddForeignKey
ALTER TABLE "Waiver" ADD CONSTRAINT "Waiver_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: versions now hang off a waiver; a studio can have several.
ALTER TABLE "WaiverVersion" ADD COLUMN "waiverId" TEXT;
ALTER TABLE "WaiverVersion" ALTER COLUMN "locationId" DROP NOT NULL;

-- DropIndex: (locationId, version) is no longer unique — the class waiver and
-- the membership waiver at one studio each have a v1.
DROP INDEX "WaiverVersion_locationId_version_key";

-- Backfill: one CLASS waiver per studio that has versions, named after it.
INSERT INTO "Waiver" ("id", "name", "kind", "locationId", "createdAt", "updatedAt")
SELECT
    'wvr_' || replace(gen_random_uuid()::text, '-', ''),
    l."name" || ' waiver',
    'CLASS',
    l."id",
    COALESCE((SELECT MIN(v."createdAt") FROM "WaiverVersion" v WHERE v."locationId" = l."id"), CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "Location" l
WHERE EXISTS (SELECT 1 FROM "WaiverVersion" v WHERE v."locationId" = l."id");

UPDATE "WaiverVersion" v
SET "waiverId" = w."id"
FROM "Waiver" w
WHERE w."locationId" = v."locationId" AND w."kind" = 'CLASS' AND v."waiverId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WaiverVersion_waiverId_version_key" ON "WaiverVersion"("waiverId", "version");

-- AddForeignKey
ALTER TABLE "WaiverVersion" ADD CONSTRAINT "WaiverVersion_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The studio link is optional now (all-studio waivers), so it follows the
-- optional-relation rule: SET NULL instead of RESTRICT.
ALTER TABLE "WaiverVersion" DROP CONSTRAINT "WaiverVersion_locationId_fkey";
ALTER TABLE "WaiverVersion" ADD CONSTRAINT "WaiverVersion_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
