-- CreateEnum
CREATE TYPE "PieceStatus" AS ENUM ('INTAKE', 'DRYING', 'BISQUE', 'GLAZE', 'READY', 'PICKED_UP');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "posOrderItemId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "smsNumber" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "taxEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stripeInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "PosOrder" ADD COLUMN     "stripeTaxCalculationId" TEXT;

-- AlterTable
ALTER TABLE "PosOrderItem" ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCode" TEXT;

-- AlterTable
ALTER TABLE "StudioSession" ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "WaiverSignature" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'platform';

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioSessionId" TEXT,
    "locationId" TEXT NOT NULL,
    "groupName" TEXT,
    "pieceCount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrls" TEXT[],
    "sharePermission" BOOLEAN NOT NULL,
    "status" "PieceStatus" NOT NULL DEFAULT 'INTAKE',
    "weightOz" INTEGER,
    "chargedCents" INTEGER,
    "posOrderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Piece_locationId_status_idx" ON "Piece"("locationId", "status");

-- CreateIndex
CREATE INDEX "Piece_userId_idx" ON "Piece"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_posOrderItemId_key" ON "Booking"("posOrderItemId");

-- CreateIndex
CREATE INDEX "Conversation_locationId_idx" ON "Conversation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeInvoiceId_key" ON "Payment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "StudioSession_seriesId_idx" ON "StudioSession"("seriesId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_studioSessionId_fkey" FOREIGN KEY ("studioSessionId") REFERENCES "StudioSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill structured addresses for Stripe Tax from the existing free-text
-- address. Matches on the exact current string so it is a no-op anywhere the
-- rows differ (e.g. a fresh database). Lehi's postal code (84043) is inferred
-- from the street address and needs confirming.
UPDATE "Location"
SET "addressLine1" = '308 E 300 S', "city" = 'Provo', "state" = 'UT', "postalCode" = '84606'
WHERE "address" = '308 E 300 S Provo Utah' AND "postalCode" IS NULL;

UPDATE "Location"
SET "addressLine1" = '4275 N Thanksgiving Way', "city" = 'Lehi', "state" = 'UT', "postalCode" = '84043'
WHERE "address" = '4275 N Thanksgiving Way Lehi Utah' AND "postalCode" IS NULL;
