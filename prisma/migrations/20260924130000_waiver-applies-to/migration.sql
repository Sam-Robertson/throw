-- A waiver can be required by every booking of its kind (the default, as
-- before) or only by some: courses, events, chosen class types, chosen
-- membership plans. Additive.

ALTER TABLE "Waiver" ADD COLUMN "appliesTo" TEXT NOT NULL DEFAULT 'ALL';

CREATE TABLE "WaiverSessionType" (
    "waiverId" TEXT NOT NULL,
    "sessionTypeId" TEXT NOT NULL,

    CONSTRAINT "WaiverSessionType_pkey" PRIMARY KEY ("waiverId","sessionTypeId")
);

CREATE INDEX "WaiverSessionType_sessionTypeId_idx" ON "WaiverSessionType"("sessionTypeId");

ALTER TABLE "WaiverSessionType" ADD CONSTRAINT "WaiverSessionType_waiverId_fkey"
    FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaiverSessionType" ADD CONSTRAINT "WaiverSessionType_sessionTypeId_fkey"
    FOREIGN KEY ("sessionTypeId") REFERENCES "SessionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WaiverMembershipPlan" (
    "waiverId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "WaiverMembershipPlan_pkey" PRIMARY KEY ("waiverId","planId")
);

CREATE INDEX "WaiverMembershipPlan_planId_idx" ON "WaiverMembershipPlan"("planId");

ALTER TABLE "WaiverMembershipPlan" ADD CONSTRAINT "WaiverMembershipPlan_waiverId_fkey"
    FOREIGN KEY ("waiverId") REFERENCES "Waiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaiverMembershipPlan" ADD CONSTRAINT "WaiverMembershipPlan_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
