-- Site-wide settings staff change from the admin without a deploy (the
-- announcement bar first: JP wants to switch promos on and off himself).
-- Additive.

CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
