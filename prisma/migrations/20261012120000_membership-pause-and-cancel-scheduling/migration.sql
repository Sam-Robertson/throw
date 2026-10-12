-- A customer's cancellation now takes effect at a period end (by the 15th:
-- this period; after: the next), so the membership remembers when it ends and
-- why they left. Additive.

ALTER TABLE "Membership" ADD COLUMN "cancelAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN "cancelReason" TEXT;
