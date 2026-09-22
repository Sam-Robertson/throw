// Brings products and discounts in line with what throwartstudio.com sells:
// finished pieces ($9.99 / $12.99 / $14.99), class packs (5, 10, 15) and the
// GRAND30 Lehi grand-opening code. Nothing else is on the site, so nothing
// else is created (Sam, 2026-09-21). Rows an earlier version of this script
// created for firing, clay, shipping and staff discounts are archived.
//
// What it does:
//   1. PRODUCTS  — matches on RetailProduct.slug. Creates what's missing and
//                  sets name, category, unit, price, class credits and sort
//                  order on what exists. Products are studio-independent
//                  (locationId null). taxCode is left null so the category
//                  default in src/config/taxCodes.ts applies.
//   2. DISCOUNTS — matches on DiscountCode.code. Creates GRAND30 if missing,
//                  linked to the Lehi studio. Promo codes are managed by the
//                  client in admin, so once it exists the script only repairs
//                  its studio link and reports any other difference.
//   3. RETIRE    — archives the products and discounts listed above.
//   Nothing is ever deleted.
//
// Always prints the plan. Pass --apply to actually write. A second --apply run
// reports no changes.
//
// Run with (never against the database in .env — pass DATABASE_URL explicitly):
//   npm run sync:products
//   npm run sync:products -- --apply
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Category = "PIECES" | "FIRING" | "CLAY" | "CLASS_PACK" | "SHIPPING";

type ProductEntry = {
  slug: string;
  name: string;
  category: Category;
  /** null = OPEN in the catalog: inactive, isPriced false, $0 placeholder. */
  priceCents: number | null;
  unit?: "EACH" | "LB";
  minChargeCents?: number;
  membersOnly?: boolean;
  classCredits?: number;
  description?: string;
};

const PRODUCTS: ProductEntry[] = [
  // Pieces, paid in studio after a Clay Together class. The site lists
  // "$9.99-$14.99 per finished piece" (up to 1 lb, 1.5 lb, 2 lb).
  { slug: "piece-1lb", name: "1 lb piece", category: "PIECES", priceCents: 999 },
  { slug: "piece-1-5lb", name: "1.5 lb piece", category: "PIECES", priceCents: 1299 },
  { slug: "piece-2lb", name: "2 lb piece", category: "PIECES", priceCents: 1499 },

  // Class packs: "Pick 5, 10, or 15 classes … Credits do not expire … for
  // individual use only." Prices are the studio's Momence catalog prices.
  { slug: "class-pack-5", name: "5 class pack", category: "CLASS_PACK", priceCents: 15000, classCredits: 5 },
  { slug: "class-pack-10", name: "10 class pack", category: "CLASS_PACK", priceCents: 27000, classCredits: 10 },
  { slug: "class-pack-15", name: "15 class pack", category: "CLASS_PACK", priceCents: 36000, classCredits: 15 },
];

// Rows an earlier version of this script created that are not on the website:
// archived on sight, never deleted.
const RETIRE_PRODUCT_SLUGS = [
  "piece-over-2lb", "add-handle", "glazed-by-us", "extra-clay",
  "glaze-firing", "glaze-firing-oversize", "bisque-firing",
  "clay-b-mix", "clay-recycled", "clay-speckled-buff", "clay-charcoal",
  "clay-b-mix-bag-10lb", "clay-b-mix-bag-25lb", "clay-speckled-buff-bag-10lb", "clay-speckled-buff-bag-25lb",
  "clay-charcoal-bag-10lb", "clay-charcoal-bag-25lb", "clay-sample-pack",
  "shipping-1-2-pieces", "shipping-3-4-pieces", "shipping-5-plus-pieces",
];
const RETIRE_DISCOUNT_CODES = ["STAFF10", "COMMIT3", "COMMIT12", "GROUPEXTRAS20", "GETOUTPASS", "FREEWHEEL", "KICKSTART50"];

const CLASS_PACK_DESCRIPTION = "Credits never expire and are not shareable.";

type DiscountEntry = {
  code: string;
  name: string;
  description: string;
  value: number; // percent
  scope: "RETAIL" | "PIECES" | "CLASSES" | "EVERYTHING";
  appliesVia: "AUTOMATIC" | "CODE" | "STAFF";
  autoCommitmentMonths?: number;
  /** Class type slug, resolved at run time. */
  sessionTypeSlug?: string;
  productSlug?: string;
  maxUnits?: number;
  maxUsesPerCustomerPerYear?: number;
  requiresNote?: boolean;
  requiresGroupEvent?: boolean;
  /** Studio, matched on a case-insensitive name fragment. */
  locationNameContains?: string;
};

// The only code on the website: "Use Code: Grand30 at checkout!" on the Lehi pages.
const DISCOUNTS: DiscountEntry[] = [
  {
    code: "GRAND30",
    name: "Lehi grand opening",
    description: "30% off Lehi courses. End date OPEN — set it in admin when the client confirms.",
    value: 30,
    scope: "CLASSES",
    appliesVia: "CODE",
    locationNameContains: "lehi",
  },
];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function priceLabel(entry: ProductEntry): string {
  if (entry.priceCents === null) return "OPEN (inactive, not priced)";
  return `${money(entry.priceCents)}${entry.unit === "LB" ? " per lb" : ""}`;
}

/** `wanted` fields whose current value differs, as "field: old -> new". */
function diff<T extends Record<string, unknown>>(current: Record<string, unknown>, wanted: T): string[] {
  return Object.entries(wanted)
    .filter(([key, value]) => current[key] !== value)
    .map(([key, value]) => `${key}: ${JSON.stringify(current[key])} -> ${JSON.stringify(value)}`);
}

async function syncProducts(): Promise<number> {
  let changes = 0;
  console.log("PRODUCTS");

  const existing = await prisma.retailProduct.findMany({
    where: { slug: { in: PRODUCTS.map((p) => p.slug) } },
  });
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  let lastCategory = "";
  let sortOrder = 0;
  for (const entry of PRODUCTS) {
    sortOrder = entry.category === lastCategory ? sortOrder + 10 : 10;
    lastCategory = entry.category;

    const isPriced = entry.priceCents !== null;
    const wanted = {
      name: entry.name,
      description:
        entry.description ?? (entry.category === "CLASS_PACK" ? CLASS_PACK_DESCRIPTION : null),
      category: entry.category,
      unit: entry.unit ?? "EACH",
      priceCents: entry.priceCents ?? 0,
      isPriced,
      minChargeCents: entry.minChargeCents ?? null,
      membersOnly: entry.membersOnly ?? false,
      trackInventory: false,
      classCredits: entry.classCredits ?? null,
      sortOrder,
      locationId: null,
    };

    const current = bySlug.get(entry.slug);
    if (!current) {
      changes++;
      console.log(`  CREATE   ${entry.slug.padEnd(30)} "${entry.name}" ${priceLabel(entry)}`);
      if (APPLY) {
        await prisma.retailProduct.create({
          data: { ...wanted, slug: entry.slug, isActive: isPriced, inventory: 0 },
        });
      }
      continue;
    }

    // An unpriced product can never be on sale; a priced one keeps whatever
    // active state admin gave it.
    const changed = diff(current, isPriced ? wanted : { ...wanted, isActive: false });
    if (changed.length === 0) {
      const state = current.archivedAt ? "  [archived in admin]" : !current.isActive && isPriced ? "  [inactive in admin]" : "";
      console.log(`  OK       ${entry.slug.padEnd(30)} ${priceLabel(entry)}${state}`);
      continue;
    }
    changes++;
    console.log(`  UPDATE   ${entry.slug.padEnd(30)} ${changed.join(", ")}`);
    if (APPLY) {
      await prisma.retailProduct.update({
        where: { id: current.id },
        data: isPriced ? wanted : { ...wanted, isActive: false },
      });
    }
  }

  return changes;
}

async function syncDiscounts(): Promise<{ changes: number; warnings: string[] }> {
  let changes = 0;
  const warnings: string[] = [];
  console.log("\nDISCOUNTS");

  const [existing, sessionTypes, locations] = await Promise.all([
    prisma.discountCode.findMany({ where: { code: { in: DISCOUNTS.map((d) => d.code) } } }),
    prisma.sessionType.findMany({
      where: { slug: { in: DISCOUNTS.flatMap((d) => (d.sessionTypeSlug ? [d.sessionTypeSlug] : [])) } },
      select: { id: true, slug: true, archivedAt: true },
    }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);
  const byCode = new Map(existing.map((d) => [d.code, d]));
  const typeBySlug = new Map(sessionTypes.filter((t) => !t.archivedAt).map((t) => [t.slug, t.id]));

  for (const entry of DISCOUNTS) {
    const sessionTypeId = entry.sessionTypeSlug ? (typeBySlug.get(entry.sessionTypeSlug) ?? null) : null;
    const location = entry.locationNameContains
      ? locations.find((l) => l.name.toLowerCase().includes(entry.locationNameContains!))
      : undefined;
    const locationId = location?.id ?? null;

    // A discount that can't be tied to its class type or studio yet would
    // apply far too widely, so it stays off until a later run can link it.
    const missing: string[] = [];
    if (entry.sessionTypeSlug && !sessionTypeId) missing.push(`class type "${entry.sessionTypeSlug}"`);
    if (entry.locationNameContains && !locationId) missing.push(`a studio named like "${entry.locationNameContains}"`);
    if (missing.length > 0) {
      warnings.push(
        `${entry.code}: ${missing.join(" and ")} not found, so it is INACTIVE and unlinked. ` +
          (entry.sessionTypeSlug && !sessionTypeId
            ? "Run scripts/sync-class-types.ts, then run this script again."
            : "Create the studio, then run this script again."),
      );
    }

    const wanted = {
      name: entry.name,
      description: entry.description,
      type: "percent",
      value: entry.value,
      scope: entry.scope,
      appliesVia: entry.appliesVia,
      autoCommitmentMonths: entry.autoCommitmentMonths ?? null,
      sessionTypeId,
      productSlug: entry.productSlug ?? null,
      maxUnits: entry.maxUnits ?? null,
      maxUsesPerCustomerPerYear: entry.maxUsesPerCustomerPerYear ?? null,
      requiresNote: entry.requiresNote ?? false,
      requiresGroupEvent: entry.requiresGroupEvent ?? false,
      locationId,
    };
    const summary = `${entry.value}% ${entry.scope} via ${entry.appliesVia}`;

    const current = byCode.get(entry.code);
    if (!current) {
      changes++;
      console.log(
        `  CREATE   ${entry.code.padEnd(14)} ${summary}${missing.length > 0 ? "  [INACTIVE: not linked yet]" : ""}`,
      );
      if (APPLY) {
        await prisma.discountCode.create({
          data: { ...wanted, code: entry.code, isActive: missing.length === 0 },
        });
      }
      continue;
    }

    // Link repair: a discount created unlinked (and so inactive) gets its
    // class type / studio, and is switched on, once they exist.
    const wasUnlinked =
      (entry.sessionTypeSlug !== undefined && current.sessionTypeId === null) ||
      (entry.locationNameContains !== undefined && current.locationId === null);
    const link: Prisma.DiscountCodeUncheckedUpdateInput = {};
    if (entry.sessionTypeSlug && sessionTypeId && current.sessionTypeId !== sessionTypeId) {
      link.sessionTypeId = sessionTypeId;
    }
    if (entry.locationNameContains && locationId && current.locationId !== locationId) {
      link.locationId = locationId;
    }
    if (wasUnlinked && missing.length === 0 && !current.isActive && !current.archivedAt) {
      link.isActive = true;
    }

    const managed = entry.appliesVia !== "CODE";
    // Never unlink: a missing class type must not widen an existing discount.
    const comparable = {
      ...wanted,
      sessionTypeId: sessionTypeId ?? current.sessionTypeId,
      locationId: locationId ?? current.locationId,
    };
    const drift = diff(current, comparable);
    const linkKeys = Object.keys(link);

    if (managed ? drift.length === 0 && linkKeys.length === 0 : linkKeys.length === 0) {
      const note = !managed && drift.length > 0 ? `  [edited in admin, left alone: ${drift.join(", ")}]` : "";
      console.log(`  OK       ${entry.code.padEnd(14)} ${summary}${current.isActive ? "" : "  [inactive]"}${note}`);
      continue;
    }

    changes++;
    const data = managed ? { ...comparable, ...link } : link;
    console.log(`  UPDATE   ${entry.code.padEnd(14)} ${diff(current, data as Record<string, unknown>).join(", ")}`);
    if (APPLY) {
      await prisma.discountCode.update({ where: { id: current.id }, data });
    }
  }

  return { changes, warnings };
}

async function retireLeftovers(): Promise<number> {
  let changes = 0;
  console.log("\nRETIRE (not on the website; archived, never deleted)");
  const products = await prisma.retailProduct.findMany({
    where: { slug: { in: RETIRE_PRODUCT_SLUGS }, OR: [{ isActive: true }, { archivedAt: null }] },
  });
  for (const p of products) {
    changes++;
    console.log(`  RETIRE   ${p.slug}`);
    if (APPLY) await prisma.retailProduct.update({ where: { id: p.id }, data: { isActive: false, archivedAt: new Date() } });
  }
  const discounts = await prisma.discountCode.findMany({
    where: { code: { in: RETIRE_DISCOUNT_CODES }, OR: [{ isActive: true }, { archivedAt: null }] },
  });
  for (const d of discounts) {
    changes++;
    console.log(`  RETIRE   ${d.code}`);
    if (APPLY) await prisma.discountCode.update({ where: { id: d.id }, data: { isActive: false, archivedAt: new Date() } });
  }
  if (changes === 0) console.log("  (nothing to do)");
  return changes;
}

async function main() {
  console.log(`Catalog product and discount sync — ${APPLY ? "APPLYING" : "dry run (pass --apply to write)"}\n`);

  const productChanges = await syncProducts();
  const { changes: discountChanges, warnings } = await syncDiscounts();
  const retired = await retireLeftovers();

  if (warnings.length > 0) {
    console.log("\nWARNINGS");
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  const total = productChanges + discountChanges + retired;
  console.log(
    total === 0
      ? "\nNo changes: products and discounts already match the catalog."
      : `\n${total} change${total === 1 ? "" : "s"} ${APPLY ? "applied" : "planned. Re-run with --apply to write."}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
