-- AlterTable
ALTER TABLE "Piece" ADD COLUMN     "bagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "instructorName" TEXT,
ADD COLUMN     "loggedById" TEXT,
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "readyNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "staffNote" TEXT,
ADD COLUMN     "textOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

