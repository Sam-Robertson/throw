-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "appliesVia" TEXT NOT NULL DEFAULT 'CODE',
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "autoCommitmentMonths" INTEGER,
ADD COLUMN     "maxUnits" INTEGER,
ADD COLUMN     "maxUsesPerCustomerPerYear" INTEGER,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "productSlug" TEXT,
ADD COLUMN     "requiresGroupEvent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresNote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'EVERYTHING',
ADD COLUMN     "sessionTypeId" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "commitmentTermId" TEXT;

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "capGroupId" TEXT,
ADD COLUMN     "forfeitsRateOnCancelOrFreeze" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFounding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLegacy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceNeedsConfirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tier" TEXT;

-- AlterTable
ALTER TABLE "PosOrder" ADD COLUMN     "parkedAt" TIMESTAMP(3),
ADD COLUMN     "walkInName" TEXT,
ADD COLUMN     "walkInPhone" TEXT;

-- AlterTable
ALTER TABLE "PosOrderItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "RetailProduct" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "classCredits" INTEGER,
ADD COLUMN     "isPriced" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "membersOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minChargeCents" INTEGER,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCode" TEXT,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'EACH';

-- AlterTable
ALTER TABLE "SessionType" ADD COLUMN     "allowsWheelSharing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isTicketEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'EVENT',
ADD COLUMN     "maxAge" INTEGER,
ADD COLUMN     "maxPeoplePerWheel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "memberPriceCents" INTEGER,
ADD COLUMN     "membersOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minAge" INTEGER,
ADD COLUMN     "priceUnit" TEXT NOT NULL DEFAULT 'PER_PERSON',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "StudioSession" ADD COLUMN     "isTicketEligibleOverride" BOOLEAN,
ADD COLUMN     "priceCentsOverride" INTEGER,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountCreditCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MembershipCapGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cap" INTEGER NOT NULL,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipCapGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentTerm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "months" INTEGER,
    "joiningFeeCents" INTEGER NOT NULL DEFAULT 0,
    "retailDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "includesGuestPass" BOOLEAN NOT NULL DEFAULT false,
    "includesVideoLibrary" BOOLEAN NOT NULL DEFAULT false,
    "freeMonths" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitmentTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipAddOn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER,
    "billingIntervalDays" INTEGER NOT NULL DEFAULT 30,
    "stripePriceId" TEXT,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipAddOnAssignment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MembershipAddOnAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezePolicy" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "monthlyFeeCents" INTEGER,
    "creditCentsPerFrozenMonth" INTEGER,
    "forfeitsFoundingRate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreezePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTypeLocationPrice" (
    "id" TEXT NOT NULL,
    "sessionTypeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "memberPriceCents" INTEGER,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTypeLocationPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassCreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "posOrderItemId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT,
    "posOrderId" TEXT,
    "bookingId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrderDiscount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountCodeId" TEXT,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosOrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCapGroup_slug_key" ON "MembershipCapGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CommitmentTerm_slug_key" ON "CommitmentTerm"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipAddOn_slug_key" ON "MembershipAddOn"("slug");

-- CreateIndex
CREATE INDEX "MembershipAddOnAssignment_membershipId_idx" ON "MembershipAddOnAssignment"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "FreezePolicy_locationId_key" ON "FreezePolicy"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTypeLocationPrice_sessionTypeId_locationId_key" ON "SessionTypeLocationPrice"("sessionTypeId", "locationId");

-- CreateIndex
CREATE INDEX "ClassCreditLedger_userId_idx" ON "ClassCreditLedger"("userId");

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountCodeId_userId_idx" ON "DiscountRedemption"("discountCodeId", "userId");

-- CreateIndex
CREATE INDEX "PosOrderDiscount_orderId_idx" ON "PosOrderDiscount"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailProduct_slug_key" ON "RetailProduct"("slug");

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_capGroupId_fkey" FOREIGN KEY ("capGroupId") REFERENCES "MembershipCapGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCapGroup" ADD CONSTRAINT "MembershipCapGroup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipAddOn" ADD CONSTRAINT "MembershipAddOn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipAddOnAssignment" ADD CONSTRAINT "MembershipAddOnAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipAddOnAssignment" ADD CONSTRAINT "MembershipAddOnAssignment_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "MembershipAddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreezePolicy" ADD CONSTRAINT "FreezePolicy_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_commitmentTermId_fkey" FOREIGN KEY ("commitmentTermId") REFERENCES "CommitmentTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTypeLocationPrice" ADD CONSTRAINT "SessionTypeLocationPrice_sessionTypeId_fkey" FOREIGN KEY ("sessionTypeId") REFERENCES "SessionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTypeLocationPrice" ADD CONSTRAINT "SessionTypeLocationPrice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCreditLedger" ADD CONSTRAINT "ClassCreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_sessionTypeId_fkey" FOREIGN KEY ("sessionTypeId") REFERENCES "SessionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderDiscount" ADD CONSTRAINT "PosOrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderDiscount" ADD CONSTRAINT "PosOrderDiscount_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

