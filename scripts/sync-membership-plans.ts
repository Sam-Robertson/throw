// Brings the membership catalog in line with docs/throw-catalog.md section 4:
// the plans, the Lehi founding cap, commitment terms, the guest pass add-on
// and a freeze policy per studio.
//
// Before this, the only active plans were three dev-seed rows ("Annual" $899,
// "Open Studio Monthly" $89, "Studio Plus" $149) and one Momence import
// ("Pro 3-Month" $90). None of the real plans existed, every plan had
// unlimited tickets (classTicketsPerPeriod null) and no joining fee.
//
// What it does:
//   1. STUDIOS     — finds Provo ("Throw Art Studio") and Lehi ("Throw Art
//                    Studio - Lehi") by name. Stops if either is missing.
//   2. CAP GROUPS  — "lehi-founding": 50 founding members across all tiers.
//   3. PLANS       — Basic / Pro / Expert for both studios (Lehi copies the
//                    Provo price, flagged "needs confirmation"), the three
//                    Lehi founding plans, and the three legacy plans
//                    (active so staff can assign them, never public).
//   4. TERMS       — month to month, 3 month, 12 month.
//   5. ADD-ONS     — guest pass.
//   6. FREEZE      — one policy per studio, amounts left empty.
//   7. RETIRE      — the dev-seed plans and the still-active Momence plan
//                    become inactive and non-public. Every imported Momence
//                    plan (slug ends in its 6-digit Momence id) is marked
//                    legacy and non-public so it can never show on the site.
//
// OPEN in the catalog, so deliberately NOT invented here:
//   - ticket rollover            -> ticketRolloverEnabled false, no cap
//   - legacy plan tickets/shelf  -> 0 tickets, no shelf. It can't be null:
//                                   null means UNLIMITED (src/lib/credits.ts).
//   - freeze fee and credit      -> null
//   - Lehi standard prices       -> Provo's, priceNeedsConfirmation true
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
const YEARLY = 365;

// Catalog 4.1: included with every standard and founding plan.
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
const FOUNDING_PRICE_CENTS: Record<string, number> = { BASIC: 5500, PRO: 9500, EXPERT: 10500 };

// Month to month is the default, so the plan carries that joining fee. A
// commitment term chosen at checkout replaces it (both waive it).
const MONTH_TO_MONTH_JOINING_FEE_CENTS = 2500;

const FOUNDING_CAP_GROUP = { slug: "lehi-founding", name: "Lehi founding members", cap: 50, studio: "lehi" as StudioKey };

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

type PlanEntry = { slug: string; studio: StudioKey; capGroupSlug: string | null; fields: PlanFields };

function standardPlan(studio: StudioKey, t: (typeof TIERS)[number]): PlanEntry {
  return {
    slug: `${studio}-${t.label.toLowerCase()}`,
    studio,
    capGroupSlug: null,
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
      joiningFeeCents: MONTH_TO_MONTH_JOINING_FEE_CENTS,
      commitmentMonths: null,
      isActive: true,
      isPublic: true,
      isLegacy: false,
      isFounding: false,
      forfeitsRateOnCancelOrFreeze: false,
      // Lehi's standard prices are copied from Provo until the client confirms them.
      priceNeedsConfirmation: studio === "lehi",
      perks: STANDARD_PERKS,
    },
  };
}

function foundingPlan(t: (typeof TIERS)[number]): PlanEntry {
  const base = standardPlan("lehi", t);
  return {
    slug: `lehi-founding-${t.label.toLowerCase()}`,
    studio: "lehi",
    capGroupSlug: FOUNDING_CAP_GROUP.slug,
    fields: {
      ...base.fields,
      name: `Founding ${t.label}`,
      price: FOUNDING_PRICE_CENTS[t.tier],
      isFounding: true,
      forfeitsRateOnCancelOrFreeze: true,
      priceNeedsConfirmation: false,
    },
  };
}

// Legacy plans belong to Provo: Lehi opens in October 2026 and has no legacy
// members. Tickets and shelf are OPEN, so 0 tickets and no shelf, never null.
function legacyPlan(slug: string, name: string, price: number, days: number, tier: Tier): PlanEntry {
  return {
    slug,
    studio: "provo",
    capGroupSlug: null,
    fields: {
      name,
      price,
      billingIntervalDays: days,
      tier,
      classTicketsPerPeriod: 0,
      ticketRolloverEnabled: false,
      ticketRolloverMaxTickets: null,
      shelfType: null,
      hasShelfSpace: false,
      joiningFeeCents: 0,
      commitmentMonths: null,
      isActive: true,
      isPublic: false,
      isLegacy: true,
      isFounding: false,
      forfeitsRateOnCancelOrFreeze: false,
      priceNeedsConfirmation: false,
      perks: null,
    },
  };
}

const PLANS: PlanEntry[] = [
  ...TIERS.map((t) => standardPlan("provo", t)),
  ...TIERS.map((t) => standardPlan("lehi", t)),
  ...TIERS.map((t) => foundingPlan(t)),
  legacyPlan("pro-legacy", "Pro Legacy", 9000, MONTHLY, "PRO"),
  legacyPlan("student-monthly", "Student Monthly", 6000, MONTHLY, "STUDENT"),
  legacyPlan("basic-annual", "Basic Annual", 50000, YEARLY, "BASIC"),
];

const TERMS = [
  {
    slug: "month-to-month",
    fields: {
      name: "Month to month",
      months: null as number | null,
      joiningFeeCents: MONTH_TO_MONTH_JOINING_FEE_CENTS,
      retailDiscountPercent: 0,
      includesGuestPass: false,
      includesVideoLibrary: false,
      freeMonths: 0,
      isActive: true,
      sortOrder: 0,
    },
  },
  {
    slug: "3-month",
    fields: {
      name: "3 month commitment",
      months: 3 as number | null,
      joiningFeeCents: 0,
      retailDiscountPercent: 10,
      includesGuestPass: false,
      includesVideoLibrary: true,
      freeMonths: 0,
      isActive: true,
      sortOrder: 1,
    },
  },
  {
    slug: "12-month",
    fields: {
      name: "12 month commitment",
      months: 12 as number | null,
      joiningFeeCents: 0,
      retailDiscountPercent: 20,
      includesGuestPass: true,
      includesVideoLibrary: true,
      freeMonths: 1,
      isActive: true,
      sortOrder: 2,
    },
  },
];

// One guest pass for both studios (locationId null): the catalog gives a
// single price, and MembershipAddOn has no "needs confirmation" flag that a
// copied Lehi row would need. The slug is what the Stripe webhook looks up to
// record the pass included with a 12 month commitment.
const ADD_ONS = [
  {
    slug: "guest-pass",
    fields: { name: "Guest Pass", priceCents: 2500 as number | null, billingIntervalDays: MONTHLY, isActive: true },
  },
];

// Retired outright: inactive, non-public, archived. The first three are the
// dev-seed rows that reached production; the rest only exist in dev databases
// (prisma/seed.ts), where they would otherwise sit next to the real plans.
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

  console.log("\nCAP GROUPS");
  const capGroupIds = new Map<string, string>();
  {
    const g = FOUNDING_CAP_GROUP;
    const wanted = { name: g.name, cap: g.cap, locationId: studioIds[g.studio] };
    const existing = await prisma.membershipCapGroup.findUnique({ where: { slug: g.slug } });
    const action = report(`${g.slug} (cap ${g.cap})`, existing !== null, existing ? diff(existing, wanted) : []);
    if (existing) capGroupIds.set(g.slug, existing.id);
    if (APPLY && action === "create") {
      const row = await prisma.membershipCapGroup.create({ data: { slug: g.slug, ...wanted } });
      capGroupIds.set(g.slug, row.id);
    }
    if (APPLY && action === "update") {
      await prisma.membershipCapGroup.update({ where: { slug: g.slug }, data: wanted });
    }
  }

  console.log("\nPLANS");
  for (const entry of PLANS) {
    const { perks, ...scalars } = entry.fields;
    // In a dry run the cap group may not exist yet; "(new)" keeps the diff quiet.
    const capGroupId = entry.capGroupSlug ? (capGroupIds.get(entry.capGroupSlug) ?? "(new)") : null;
    const wanted = { ...scalars, perks, locationId: studioIds[entry.studio], capGroupId };
    const existing = await prisma.membershipPlan.findUnique({ where: { slug: entry.slug } });
    const label = `${entry.slug}  "${entry.fields.name}" ${money(entry.fields.price)} / ${entry.fields.billingIntervalDays}d, ${entry.fields.classTicketsPerPeriod} tickets`;
    const action = report(label, existing !== null, existing ? diff(existing, wanted) : []);
    if (!APPLY || action === "skip") continue;

    const data = {
      ...scalars,
      perks: perks ?? Prisma.DbNull,
      locationId: studioIds[entry.studio],
      capGroupId: capGroupId === "(new)" ? null : capGroupId,
    };
    if (action === "create") await prisma.membershipPlan.create({ data: { slug: entry.slug, ...data } });
    else await prisma.membershipPlan.update({ where: { slug: entry.slug }, data });
  }

  console.log("\nCOMMITMENT TERMS");
  for (const term of TERMS) {
    const existing = await prisma.commitmentTerm.findUnique({ where: { slug: term.slug } });
    const f = term.fields;
    const label = `${term.slug}  joining fee ${money(f.joiningFeeCents)}, ${f.retailDiscountPercent}% retail, ${f.freeMonths} free month(s)`;
    const action = report(label, existing !== null, existing ? diff(existing, f) : []);
    if (APPLY && action === "create") await prisma.commitmentTerm.create({ data: { slug: term.slug, ...f } });
    if (APPLY && action === "update") await prisma.commitmentTerm.update({ where: { slug: term.slug }, data: f });
  }

  console.log("\nADD-ONS");
  for (const addOn of ADD_ONS) {
    const existing = await prisma.membershipAddOn.findUnique({ where: { slug: addOn.slug } });
    const wanted = { ...addOn.fields, locationId: null };
    const label = `${addOn.slug}  "${addOn.fields.name}" ${money(addOn.fields.priceCents)} / ${addOn.fields.billingIntervalDays}d, both studios`;
    const action = report(label, existing !== null, existing ? diff(existing, wanted) : []);
    if (APPLY && action === "create") await prisma.membershipAddOn.create({ data: { slug: addOn.slug, ...wanted } });
    if (APPLY && action === "update") await prisma.membershipAddOn.update({ where: { slug: addOn.slug }, data: wanted });
  }

  console.log("\nFREEZE POLICY (fee and credit are OPEN, left empty)");
  for (const key of Object.keys(STUDIOS) as StudioKey[]) {
    const locationId = studioIds[key];
    const existing = await prisma.freezePolicy.findUnique({ where: { locationId } });
    // Only the founding-rate rule is catalog data; amounts typed into admin are never reset.
    const wanted = { forfeitsFoundingRate: true };
    const action = report(`${key}  forfeits founding rate`, existing !== null, existing ? diff(existing, wanted) : []);
    if (APPLY && action === "create") await prisma.freezePolicy.create({ data: { locationId, ...wanted } });
    if (APPLY && action === "update") await prisma.freezePolicy.update({ where: { locationId }, data: wanted });
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
    const isSeed = RETIRE_SEED_SLUGS.includes(plan.slug);
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

  const review = others.filter(
    (p) => !RETIRE_SEED_SLUGS.includes(p.slug) && !MOMENCE_SLUG.test(p.slug) && p.isActive && p.archivedAt === null,
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
