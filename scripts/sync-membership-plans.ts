// Brings the membership plans in line with what throwartstudio.com sells:
// Basic $70, Pro $110 and Expert $120 a month, at both studios (the Lehi
// memberships page lists the same three prices). Nothing else is on the site,
// so nothing else is created here (Sam, 2026-09-21).
//
// Before this, the only active plans were three dev-seed rows ("Annual" $899,
// "Open Studio Monthly" $89, "Studio Plus" $149) and one Momence import
// ("Pro 3-Month" $90). None of the real plans existed and every plan had
// unlimited tickets (classTicketsPerPeriod null).
//
// What it does:
//   1. STUDIOS — finds Provo ("Throw Art Studio") and Lehi ("Throw Art
//                Studio - Lehi") by name. Stops if either is missing.
//   2. PLANS   — Basic / Pro / Expert for both studios.
//   3. RETIRE  — the dev-seed plans and the still-active Momence plan become
//                inactive and non-public. Every imported Momence plan (slug
//                ends in its 6-digit Momence id) is marked legacy and
//                non-public so it can never show on the site. Anything else
//                this script once created (founding, legacy, terms, add-ons)
//                is archived the same way.
//
// Not on the site, so deliberately NOT set here: ticket rollover (off), a
// joining fee (0), commitment terms, founding rates, add-ons, freeze rules.
//
// Rows are matched on their slug. A row that doesn't exist is created. A row
// that exists but differs from the catalog is only REPORTED, because prices
// are edited in admin after launch and a re-run must not undo that; pass
// --overwrite (with --apply) to reset those rows to the catalog values.
// The retire step always applies. So the second run reports no changes.
//
// Never deletes anything, never changes the price of an imported plan, never
// touches a Membership row or a Stripe subscription, and never writes a
// stripePriceId: Stripe Prices are created by the app at checkout time with
// its own key (src/lib/stripePrices.ts), so a test-mode id can't reach the
// production database from here.
//
// Always prints the plan. Pass --apply to actually write.
//
// Run with:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-membership-plans.ts
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-membership-plans.ts --apply
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-membership-plans.ts --apply --overwrite
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");

const STUDIOS = {
  provo: "Throw Art Studio",
  lehi: "Throw Art Studio - Lehi",
} as const;
type StudioKey = keyof typeof STUDIOS;

const MONTHLY = 30;

// From the memberships page: included with every plan.
const STANDARD_PERKS = [
  "24/6 studio access",
  "Clay and firing discounts",
  "Studio glazes",
  "Workshops and member events",
];

type Tier = "BASIC" | "PRO" | "EXPERT" | "STUDENT";

const TIERS: Array<{ tier: Tier; label: string; tickets: number; shelfType: "HALF" | "FULL" | null }> = [
  { tier: "BASIC", label: "Basic", tickets: 8, shelfType: null },
  { tier: "PRO", label: "Pro", tickets: 10, shelfType: "HALF" },
  { tier: "EXPERT", label: "Expert", tickets: 12, shelfType: "FULL" },
];

const STANDARD_PRICE_CENTS: Record<string, number> = { BASIC: 7000, PRO: 11000, EXPERT: 12000 };

// The fields this script owns on a plan. Everything else (description,
// billingAnchorDay, stripePriceId, …) is left to admin.
type PlanFields = {
  name: string;
  price: number;
  billingIntervalDays: number;
  tier: Tier;
  classTicketsPerPeriod: number;
  ticketRolloverEnabled: boolean;
  ticketRolloverMaxTickets: number | null;
  shelfType: string | null;
  hasShelfSpace: boolean;
  joiningFeeCents: number;
  commitmentMonths: number | null;
  isActive: boolean;
  isPublic: boolean;
  isLegacy: boolean;
  isFounding: boolean;
  forfeitsRateOnCancelOrFreeze: boolean;
  priceNeedsConfirmation: boolean;
  perks: string[] | null;
};

type PlanEntry = { slug: string; studio: StudioKey; fields: PlanFields };

function standardPlan(studio: StudioKey, t: (typeof TIERS)[number]): PlanEntry {
  return {
    slug: `${studio}-${t.label.toLowerCase()}`,
    studio,
    fields: {
      name: t.label,
      price: STANDARD_PRICE_CENTS[t.tier],
      billingIntervalDays: MONTHLY,
      tier: t.tier,
      classTicketsPerPeriod: t.tickets,
      ticketRolloverEnabled: false,
      ticketRolloverMaxTickets: null,
      shelfType: t.shelfType,
      hasShelfSpace: t.shelfType !== null,
      joiningFeeCents: 0,
      commitmentMonths: null,
      isActive: true,
      isPublic: true,
      isLegacy: false,
      isFounding: false,
      forfeitsRateOnCancelOrFreeze: false,
      priceNeedsConfirmation: false,
      perks: STANDARD_PERKS,
    },
  };
}

// Exactly what throwartstudio.com sells: Basic, Pro and Expert at both studios.
// The Lehi memberships page shows the same three prices as Provo.
const PLANS: PlanEntry[] = [
  ...TIERS.map((t) => standardPlan("provo", t)),
  ...TIERS.map((t) => standardPlan("lehi", t)),
];

// Rows an earlier version of this script created that are not on the website.
const RETIRE_EARLIER_SLUGS = [
  "lehi-founding-basic",
  "lehi-founding-pro",
  "lehi-founding-expert",
  "pro-legacy",
  "student-monthly",
  "basic-annual",
];
const RETIRE_SEED_SLUGS = [
  "annual-membership",
  "open-studio-monthly",
  "studio-plus-monthly",
  "basic-monthly",
  "pro-monthly",
  "expert-monthly",
  "pro-3-month",
  "pro-12-month",
];

// The one Momence import that was still active. It keeps its members.
const RETIRE_MOMENCE_SLUGS = ["pro-3-month-commitment-membership-726002"];

// momence-apply.ts slugs every imported plan as "<name>-<6 digit Momence id>".
const MOMENCE_SLUG = /-\d{6}$/;

function money(cents: number | null) {
  return cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

function show(value: unknown): string {
  return Array.isArray(value) ? `[${value.length} items]` : String(value);
}

/** Catalog fields whose current value differs, as "field a -> b". */
function diff(current: Record<string, unknown>, wanted: Record<string, unknown>): string[] {
  const changes: string[] = [];
  for (const [key, value] of Object.entries(wanted)) {
    if (JSON.stringify(current[key] ?? null) !== JSON.stringify(value ?? null)) {
      changes.push(`${key} ${show(current[key] ?? null)} -> ${show(value ?? null)}`);
    }
  }
  return changes;
}

const counts = { created: 0, overwritten: 0, differs: 0, retired: 0 };

/** Prints the state of one catalog row. Returns what the caller should do. */
function report(label: string, exists: boolean, changes: string[]): "create" | "update" | "skip" {
  if (!exists) {
    counts.created++;
    console.log(`  CREATE     ${label}`);
    return "create";
  }
  if (changes.length === 0) {
    console.log(`  OK         ${label}`);
    return "skip";
  }
  if (OVERWRITE) {
    counts.overwritten++;
    console.log(`  OVERWRITE  ${label}: ${changes.join(", ")}`);
    return "update";
  }
  counts.differs++;
  console.log(`  DIFFERS    ${label}: ${changes.join(", ")}  (kept; --overwrite resets it)`);
  return "skip";
}

async function main() {
  console.log("STUDIOS");
  const studioIds = {} as Record<StudioKey, string>;
  for (const key of Object.keys(STUDIOS) as StudioKey[]) {
    const matches = await prisma.location.findMany({ where: { name: STUDIOS[key] } });
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one studio named "${STUDIOS[key]}", found ${matches.length}. Nothing was changed.`,
      );
    }
    studioIds[key] = matches[0].id;
    console.log(`  OK         ${key} = "${STUDIOS[key]}"`);
  }

  console.log("\nPLANS");
  for (const entry of PLANS) {
    const { perks, ...scalars } = entry.fields;
    const wanted = { ...scalars, perks, locationId: studioIds[entry.studio], capGroupId: null };
    const existing = await prisma.membershipPlan.findUnique({ where: { slug: entry.slug } });
    const label = `${entry.slug}  "${entry.fields.name}" ${money(entry.fields.price)} / ${entry.fields.billingIntervalDays}d, ${entry.fields.classTicketsPerPeriod} tickets`;
    const action = report(label, existing !== null, existing ? diff(existing, wanted) : []);
    if (!APPLY || action === "skip") continue;

    const data = {
      ...scalars,
      perks: perks ?? Prisma.DbNull,
      locationId: studioIds[entry.studio],
      capGroupId: null,
    };
    if (action === "create") await prisma.membershipPlan.create({ data: { slug: entry.slug, ...data } });
    else await prisma.membershipPlan.update({ where: { slug: entry.slug }, data });
  }

  console.log("\nRETIRE (never deleted; prices and memberships untouched)");
  const catalogSlugs = new Set(PLANS.map((p) => p.slug));
  const others = await prisma.membershipPlan.findMany({
    where: { slug: { notIn: [...catalogSlugs] } },
    include: { _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
  });
  let alreadyRetired = 0;
  for (const plan of others) {
    const isSeed = RETIRE_SEED_SLUGS.includes(plan.slug) || RETIRE_EARLIER_SLUGS.includes(plan.slug);
    const isMomence = MOMENCE_SLUG.test(plan.slug);
    if (!isSeed && !isMomence) continue;

    const data: Prisma.MembershipPlanUpdateInput = {};
    if (plan.isPublic) data.isPublic = false;
    if (isMomence && !plan.isLegacy) data.isLegacy = true;
    if ((isSeed || RETIRE_MOMENCE_SLUGS.includes(plan.slug)) && plan.isActive) data.isActive = false;
    if (isSeed && plan.archivedAt === null) data.archivedAt = new Date();

    if (Object.keys(data).length === 0) {
      alreadyRetired++;
      continue;
    }
    counts.retired++;
    const members = plan._count.memberships ? `  (${plan._count.memberships} membership(s) stay on it)` : "";
    console.log(`  RETIRE     ${plan.slug}: ${Object.keys(data).join(", ")}${members}`);
    if (APPLY) await prisma.membershipPlan.update({ where: { id: plan.id }, data });
  }
  if (alreadyRetired > 0) console.log(`  OK         ${alreadyRetired} plan(s) already retired`);

  // Commitment terms, add-ons and cap groups from an earlier version of this
  // script: not on the website, so switched off (never deleted).
  const staleTerms = await prisma.commitmentTerm.findMany({ where: { isActive: true } });
  for (const t of staleTerms) {
    counts.retired++;
    console.log(`  RETIRE     commitment term ${t.slug}: isActive`);
    if (APPLY) await prisma.commitmentTerm.update({ where: { id: t.id }, data: { isActive: false } });
  }
  const staleAddOns = await prisma.membershipAddOn.findMany({ where: { isActive: true } });
  for (const a of staleAddOns) {
    counts.retired++;
    console.log(`  RETIRE     add-on ${a.slug}: isActive, archivedAt`);
    if (APPLY) await prisma.membershipAddOn.update({ where: { id: a.id }, data: { isActive: false, archivedAt: new Date() } });
  }

  const review = others.filter(
    (p) => !RETIRE_SEED_SLUGS.includes(p.slug) && !RETIRE_EARLIER_SLUGS.includes(p.slug) && !MOMENCE_SLUG.test(p.slug) && p.isActive && p.archivedAt === null,
  );
  if (review.length > 0) {
    console.log("\nREVIEW (active, not in the catalog, not an import — left untouched)");
    for (const p of review) {
      console.log(`  ?          ${p.slug}  "${p.name}" ${money(p.price)}${p.isPublic ? "  PUBLIC" : ""}`);
    }
  }

  const changed = counts.created + counts.overwritten + counts.retired;
  console.log(
    `\n${APPLY ? "Applied" : "Plan"}: ${counts.created} created, ${counts.overwritten} overwritten, ` +
      `${counts.retired} retired, ${counts.differs} differ from the catalog and were kept.`,
  );
  if (changed === 0) console.log("No changes.");
  else if (!APPLY) console.log("Dry run only — re-run with --apply to write these changes.");
  if (OVERWRITE && !APPLY) console.log("--overwrite has no effect without --apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
