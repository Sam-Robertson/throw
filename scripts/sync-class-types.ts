// Brings the class types in line with docs/throw-catalog.md (sections 2 and 8)
// and archives everything the Momence import and the dev seed left behind.
// Supersedes scripts/cleanup-checkout-catalog.ts.
//
// After merge-session-types.ts there were still 52 class types, all active, 45
// of them $0: one type per studio for the same class, dated cohorts, private
// parties, piece pick-up slots, one-off events and three demo rows from the
// seed. The catalog has 7 class types, 2 Lehi youth courses and 7 member
// classes; an internal "Busy Window" block stays but is never sellable.
//
// Canonical class types are studio-independent rows (locationId null) matched
// on a stable slug. What differs between studios is a SessionTypeLocationPrice
// (Clay Together: Provo $29.99, Lehi $35). Prices are resolved everywhere by
// src/lib/sellable.ts. Catalog values marked OPEN are not invented here: an
// OPEN duration is copied from the row the type replaces and never overwritten
// afterwards, so it can be corrected in admin once the client answers.
//
// What it does:
//   1. CATALOG — creates or updates the canonical class types and their
//                per-studio prices.
//   2. KEEP    — member classes stay active, members only, ticket eligible, $0.
//                Busy Window stays active but private.
//   3. MERGE   — for each stale duplicate, moves only its UPCOMING sessions
//                (startsAt >= now, not cancelled) to the canonical type, then
//                archives it. Past sessions are never repointed, so past
//                bookings and orders keep their original class type. When the
//                old name says something the canonical name doesn't (a private
//                party's name, a workshop topic) it is copied to the session's
//                title.
//   4. ARCHIVE — retires types that are not classes at all (isActive=false,
//                isTemplate=false, archivedAt=now). Their sessions stay put:
//                archived types are hidden from every schedule and the POS.
//   5. REVIEW  — any other active type is listed and left untouched.
// Nothing is ever deleted.
//
// Matching is by slug first, then by name pattern, so it tolerates a database
// whose rows differ a little from the one it was written against. Rows it
// can't find are skipped. Safe to re-run: a second run reports no changes.
//
// Always prints the plan. Pass --apply to actually write.
//
// Run with:
//   npm run catalog:sync-class-types
//   npm run catalog:sync-class-types -- --apply
import { PrismaClient, type Prisma, type SessionType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NOW = new Date();

// Only used when a canonical type has to be created and there is no existing
// row to copy from. Both columns are NOT NULL; the plan calls it out.
const FALLBACK_DURATION_MINUTES = 120;
const FALLBACK_CAPACITY = 10;

type Studio = "PROVO" | "LEHI";

type CanonicalType = {
  slug: string;
  name: string;
  kind: "EVENT" | "COURSE";
  priceUnit: "PER_WHEEL" | "PER_PERSON" | "FLAT";
  /** null = OPEN in the catalog: copied from `inheritFrom` on create, then left alone. */
  durationMinutes: number | null;
  dropInPriceCents: number;
  memberPriceCents: number | null;
  locationPrices: { studio: Studio; priceCents: number; isConfirmed: boolean }[];
  maxPeoplePerWheel: number;
  allowsWheelSharing: boolean;
  isTicketEligible: boolean;
  membersOnly: boolean;
  isPublic: boolean;
  tags: string[];
  minAge: number | null;
  maxAge: number | null;
  /** Existing slugs to copy capacity (and an OPEN duration) from when creating. */
  inheritFrom: string[];
};

const BASE = {
  memberPriceCents: null,
  locationPrices: [],
  maxPeoplePerWheel: 1,
  allowsWheelSharing: false,
  membersOnly: false,
  isPublic: true,
  tags: [],
  minAge: null,
  maxAge: null,
} satisfies Partial<CanonicalType>;

const CATALOG: CanonicalType[] = [
  {
    ...BASE,
    slug: "clay-together",
    name: "Clay Together: Pottery Wheel Experience",
    kind: "EVENT",
    priceUnit: "PER_WHEEL",
    durationMinutes: 120,
    // Default for a session with no studio; both studios have their own price.
    dropInPriceCents: 2999,
    locationPrices: [
      { studio: "PROVO", priceCents: 2999, isConfirmed: true },
      { studio: "LEHI", priceCents: 3500, isConfirmed: true },
    ],
    maxPeoplePerWheel: 2,
    allowsWheelSharing: true,
    isTicketEligible: true,
    // Date night and bachelorette are landing pages for this class, not types.
    tags: ["date-night", "bachelorette"],
    inheritFrom: [
      "provo-clay-together-pottery-wheel-experience",
      "lehi-clay-together-pottery-wheel-experience",
    ],
  },
  {
    ...BASE,
    slug: "pottery-kickstart",
    name: "Pottery Kickstart: 4 Week Course",
    kind: "COURSE",
    priceUnit: "PER_WHEEL",
    durationMinutes: 120,
    dropInPriceCents: 20000,
    locationPrices: [
      { studio: "PROVO", priceCents: 20000, isConfirmed: true },
      { studio: "LEHI", priceCents: 20000, isConfirmed: true },
    ],
    isTicketEligible: true,
    inheritFrom: ["beginner-pottery-kickstart", "lehi-beginner-pottery-kickstart"],
  },
  {
    ...BASE,
    slug: "guided-pottery-time",
    name: "Guided Pottery Time",
    kind: "EVENT",
    priceUnit: "PER_PERSON",
    durationMinutes: null,
    // Costs one class ticket; never sold as a drop-in.
    dropInPriceCents: 0,
    isTicketEligible: true,
    membersOnly: true,
    inheritFrom: ["guided-pottery-time-members"],
  },
  {
    ...BASE,
    slug: "kids-summer-camp",
    name: "Kids Summer Camp",
    kind: "COURSE",
    priceUnit: "PER_PERSON",
    // "4 days" in the catalog; minutes per day is not stated.
    durationMinutes: null,
    dropInPriceCents: 19900,
    isTicketEligible: false,
    minAge: 8,
    maxAge: 17,
    inheritFrom: ["summer-kids-camp"],
  },
  {
    ...BASE,
    slug: "group-event",
    name: "Group Event / Private Booking",
    kind: "EVENT",
    priceUnit: "FLAT",
    durationMinutes: null,
    dropInPriceCents: 37500,
    isTicketEligible: false,
    isPublic: false,
    inheritFrom: ["group-pottery-wheel-event", "group-pottery-wheel-experience"],
  },
  {
    ...BASE,
    slug: "workshop",
    name: "Workshop",
    kind: "EVENT",
    priceUnit: "PER_PERSON",
    // "Per session" in the catalog: each session carries its own times.
    durationMinutes: null,
    // Priced per session through StudioSession.priceCentsOverride. At $0 an
    // unpriced workshop is simply not for sale.
    dropInPriceCents: 0,
    // Ticket eligibility is decided per session (isTicketEligibleOverride).
    isTicketEligible: false,
    tags: ["workshop"],
    inheritFrom: ["general-workshop"],
  },
  {
    ...BASE,
    slug: "private-lesson",
    name: "Private Lesson",
    kind: "EVENT",
    priceUnit: "PER_PERSON",
    durationMinutes: null,
    dropInPriceCents: 5500,
    memberPriceCents: 4300,
    isTicketEligible: false,
    isPublic: false,
    inheritFrom: ["private-lesson-tutoring"],
  },
  // Live on the Lehi site at $257. Whether they take class tickets is OPEN, so
  // they don't. Priced at Lehi only: at $0 they are not for sale in Provo.
  {
    ...BASE,
    slug: "lehi-after-school-course",
    name: "After-School Pottery Course",
    kind: "COURSE",
    priceUnit: "PER_PERSON",
    durationMinutes: 120,
    dropInPriceCents: 0,
    locationPrices: [{ studio: "LEHI", priceCents: 25700, isConfirmed: true }],
    isTicketEligible: false,
    minAge: 8,
    maxAge: 17,
    inheritFrom: ["lehi-after-school-pottery-course", "after-school-classes-12-18-oct-7-nov-11"],
  },
  {
    ...BASE,
    slug: "lehi-homeschool-course",
    name: "Homeschool Pottery Course",
    kind: "COURSE",
    priceUnit: "PER_PERSON",
    durationMinutes: 120,
    dropInPriceCents: 0,
    locationPrices: [{ studio: "LEHI", priceCents: 25700, isConfirmed: true }],
    isTicketEligible: false,
    minAge: 8,
    maxAge: 17,
    inheritFrom: ["lehi-homeschool-pottery-course", "lehi-after-school-pottery-course", "after-school-classes-12-18-oct-7-nov-11"],
  },
];

// Member classes: free on purpose, booked with a class ticket.
const MEMBER_SLUGS = new Set([
  "pottery-101-clay-prep-centering",
  "pottery-101-pulling-shaping",
  "pottery-101-trimming-add-ons",
  "pottery-101-glazing-finishing",
  "member-orientation",
  "member-event",
  "open-studio-members-only-multi-venue",
]);
const MEMBER_PATTERNS = [
  /^Pottery 101\b/i,
  /^Member Orientation$/i,
  /^Member Event!?$/i,
  /^Open Studio \(Members Only\)/i,
];

type StaleRule = {
  /** Canonical slug upcoming sessions move to; null = archive outright. */
  target: string | null;
  slugs: string[];
  patterns: RegExp[];
  /** Copy the old type name into StudioSession.title when moving a session. */
  keepTitle: boolean;
  why: string;
};

// First match wins, so the order matters: the outright archives come first
// ("Grand 2nd Year Birthday Party" is not a private birthday party), and the
// private summer-camp bookings are caught before the public camp.
const STALE_RULES: StaleRule[] = [
  {
    target: null,
    slugs: [
      "90-min-pottery-class",
      "free-pottery-wheel-experience-provo",
      "pay-for-pottery-pieces",
      "pottery-piece-pick-up",
      "studio-tour",
      "orem-farmers-market",
      "grand-2nd-year-birthday-party-celebration-for-throw-art-studio",
      "members-giving",
      "member-friends-halloween-pottery-night",
      "spooky-clay-night",
      "valentines-day-experience",
      "august-back-to-you-mom-reset-thursday-s-7-00-pm-august-6-13-20-27",
      // Demo rows from prisma/seed.ts that reached the live database. Slug
      // only: "Open Studio" as a name pattern would hit the members' one.
      "open-studio",
      "wheel-throwing-101",
      "hand-building-workshop",
    ],
    patterns: [
      /^90 Min\b/i,
      /^Free Pottery Wheel Experience/i, // a coupon, not a class
      /^Pay for Pottery Pieces/i,
      /^Pottery Piece Pick ?Up/i,
      /^Studio Tour/i,
      /Farmers Market/i,
      /Birthday Party Celebration/i,
      /^Members-Giving/i,
      /Halloween/i,
      /^Spooky Clay/i,
      /^Valentine/i,
      /Mom Reset/i,
    ],
    keepTitle: false,
    why: "not a class type",
  },
  {
    target: "clay-together",
    slugs: [
      "provo-clay-together-pottery-wheel-experience",
      "lehi-clay-together-pottery-wheel-experience",
      "clay-together-pottery-wheel-experience-provo",
    ],
    patterns: [/^(?:(?:Provo|Lehi) - )?Clay Together - Pottery Wheel Experience(?: - (?:Provo|Lehi))?$/i],
    keepTitle: false,
    why: "one class, priced per studio",
  },
  {
    target: "pottery-kickstart",
    slugs: [
      "4-week-course",
      "beginner-pottery-kickstart",
      "lehi-beginner-pottery-kickstart",
      "clay-together-4-week-beginner-pottery-wheel-course-provo",
      "august-4-week-course-aug-2-9-16-23-12pm",
    ],
    // Dated cohorts are sessions of the course, not class types.
    patterns: [/^(?:Lehi - )?Beginner Pottery Kickstart\b/i, /\b4 Week (?:Beginner .*)?Course\b/i],
    keepTitle: false,
    why: "4-week course duplicate",
  },
  {
    target: "pottery-kickstart",
    slugs: ["intermediate-pottery-kickstart"],
    patterns: [/^(?:Lehi - )?Intermediate Pottery Kickstart\b/i],
    keepTitle: true,
    why: "4-week course duplicate",
  },
  {
    target: "guided-pottery-time",
    slugs: ["guided-pottery-time-members"],
    patterns: [/^Guided Pottery Time\b/i],
    keepTitle: false,
    why: "renamed",
  },
  {
    target: "group-event",
    slugs: [
      "bree-goates-kid-s-birthday-parties",
      "meredith-s-group",
      "mckenzie-guymon-private-group",
      "keyla-bachelorette-party",
      "group-pottery-wheel-event",
      "group-pottery-wheel-experience",
      "kids-camp-group-wheel-event",
    ],
    patterns: [
      /\(Private Event\)/i,
      /Private (?:Group|Party|Event)\b/i,
      /birthday part/i,
      /bachelorette part/i,
      /'s Group$/i,
      /^Group Pottery Wheel (?:Event|Experience)/i,
      /Group Wheel Event/i,
    ],
    keepTitle: true,
    why: "a private booking, not a class type",
  },
  {
    target: "private-lesson",
    slugs: ["private-lesson-tutoring", "private-class-with-lexi"],
    patterns: [/^Private (?:Lesson|Class)\b/i, /Tutoring/i],
    keepTitle: true,
    why: "private lesson",
  },
  {
    target: "kids-summer-camp",
    slugs: ["summer-kids-camp"],
    patterns: [/Summer (?:Kids )?Camp/i, /^Kids Summer Camp\b/i],
    keepTitle: false,
    why: "renamed",
  },
  {
    target: "lehi-after-school-course",
    slugs: ["after-school-classes-12-18-oct-7-nov-11", "lehi-after-school-pottery-course"],
    patterns: [/After-?\s?School/i],
    keepTitle: false,
    why: "dated cohort of the Lehi after-school course",
  },
  {
    target: "lehi-homeschool-course",
    slugs: ["lehi-homeschool-pottery-course"],
    patterns: [/Home-?\s?school/i],
    keepTitle: false,
    why: "dated cohort of the Lehi homeschool course",
  },
  {
    target: "workshop",
    slugs: [
      "general-workshop",
      // Workshop topics the earlier merge missed because their names don't
      // say "workshop".
      "build-your-berry-bowl-hand-building",
      "build-your-berry-bowl-wheel-throwing-class",
      "making-bottles-with-trey",
      "throwing-bigger-with-owner-johnpaul-ryan",
    ],
    patterns: [/workshop/i],
    keepTitle: true,
    why: "a workshop topic, not a class type",
  },
];

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");
}

function matchStaleRule(t: SessionType): StaleRule | undefined {
  return (
    STALE_RULES.find((r) => r.slugs.includes(t.slug)) ??
    STALE_RULES.find((r) => r.patterns.some((p) => p.test(t.name)))
  );
}

function isMemberClass(t: SessionType) {
  return MEMBER_SLUGS.has(t.slug) || MEMBER_PATTERNS.some((p) => p.test(t.name));
}

/** Host and database only — never the credentials. */
function describeDatabase() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "(DATABASE_URL not set or unreadable)";
  }
}

async function main() {
  console.log(`Database: ${describeDatabase()}`);
  console.log(APPLY ? "Mode: APPLY\n" : "Mode: dry run (pass --apply to write)\n");

  const [types, locations, upcoming, totals, upcomingBooked] = await Promise.all([
    prisma.sessionType.findMany({ include: { locationPrices: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany(),
    prisma.studioSession.groupBy({
      by: ["sessionTypeId"],
      where: { startsAt: { gte: NOW }, isCancelled: false },
      _count: true,
    }),
    prisma.studioSession.groupBy({ by: ["sessionTypeId"], _count: true }),
    prisma.studioSession.groupBy({
      by: ["sessionTypeId"],
      where: { startsAt: { gte: NOW }, isCancelled: false, bookings: { some: { status: "CONFIRMED" } } },
      _count: true,
    }),
  ]);
  const bySlug = new Map(types.map((t) => [t.slug, t]));
  const upcomingByType = new Map(upcoming.map((u) => [u.sessionTypeId, u._count]));
  const totalByType = new Map(totals.map((u) => [u.sessionTypeId, u._count]));
  const bookedByType = new Map(upcomingBooked.map((u) => [u.sessionTypeId, u._count]));

  const lehi = locations.find((l) => /lehi/i.test(l.name));
  const provo = locations.find((l) => l.id !== lehi?.id && (/provo/i.test(`${l.name} ${l.address ?? ""}`) || l.name.trim() === "Throw Art Studio"));
  const studioId: Record<Studio, string | undefined> = { PROVO: provo?.id, LEHI: lehi?.id };
  const studioLabel = (id: string) => (id === lehi?.id ? "Lehi" : id === provo?.id ? "Provo" : id);

  // ── BEFORE ────────────────────────────────────────────────────────────────
  const activeBefore = types.filter((t) => t.isActive && t.archivedAt === null);
  console.log(`BEFORE — ${activeBefore.length} active class types (${types.length} rows in all)`);
  for (const t of activeBefore) {
    const prices = t.locationPrices.map((p) => `${studioLabel(p.locationId)} ${money(p.priceCents)}`).join(", ");
    console.log(
      `  ${t.name}  [${t.slug}]  ${money(t.dropInPriceCents)}${prices ? ` (${prices})` : ""}` +
        `  ${upcomingByType.get(t.id) ?? 0} upcoming / ${totalByType.get(t.id) ?? 0} sessions`,
    );
  }

  // ── Plan ──────────────────────────────────────────────────────────────────
  const canonicalSlugs = new Set(CATALOG.map((c) => c.slug));
  const lines: Record<"CATALOG" | "KEEP" | "MERGE" | "ARCHIVE" | "REVIEW" | "NOTES", string[]> = {
    CATALOG: [], KEEP: [], MERGE: [], ARCHIVE: [], REVIEW: [], NOTES: [],
  };
  let changes = 0;

  type CatalogWrite = {
    entry: CanonicalType;
    existingId: string | null;
    create: Prisma.SessionTypeUncheckedCreateInput | null;
    update: Prisma.SessionTypeUncheckedUpdateInput | null;
    prices: { locationId: string; priceCents: number; isConfirmed: boolean }[];
  };
  const catalogWrites: CatalogWrite[] = [];

  for (const entry of CATALOG) {
    const existing = bySlug.get(entry.slug);
    const fixed = {
      name: entry.name,
      kind: entry.kind,
      priceUnit: entry.priceUnit,
      dropInPriceCents: entry.dropInPriceCents,
      memberPriceCents: entry.memberPriceCents,
      maxPeoplePerWheel: entry.maxPeoplePerWheel,
      allowsWheelSharing: entry.allowsWheelSharing,
      isTicketEligible: entry.isTicketEligible,
      membersOnly: entry.membersOnly,
      isPublic: entry.isPublic,
      minAge: entry.minAge,
      maxAge: entry.maxAge,
      isBusyWindow: false,
      isActive: true,
      isTemplate: true,
      locationId: null,
      ...(entry.durationMinutes !== null && { durationMinutes: entry.durationMinutes }),
    };

    const wantedPrices = entry.locationPrices.flatMap((p) => {
      const locationId = studioId[p.studio];
      if (!locationId) {
        lines.NOTES.push(`No ${p.studio} studio found — skipped the ${money(p.priceCents)} price of "${entry.name}".`);
        return [];
      }
      return [{ locationId, priceCents: p.priceCents, isConfirmed: p.isConfirmed }];
    });
    const priceText = wantedPrices.length
      ? wantedPrices.map((p) => `${studioLabel(p.locationId)} ${money(p.priceCents)}`).join(", ")
      : money(entry.dropInPriceCents);

    if (!existing) {
      const source = entry.inheritFrom.map((s) => bySlug.get(s)).find((t) => t !== undefined);
      const durationMinutes = entry.durationMinutes ?? source?.durationMinutes ?? FALLBACK_DURATION_MINUTES;
      const capacity = source?.capacity ?? FALLBACK_CAPACITY;
      if (entry.durationMinutes === null)
        lines.NOTES.push(
          source
            ? `"${entry.name}": duration is OPEN in the catalog — ${durationMinutes} min copied from "${source.name}".`
            : `"${entry.name}": duration is OPEN and there was no row to copy from — placeholder ${durationMinutes} min, set it in admin.`,
        );
      if (!source) lines.NOTES.push(`"${entry.name}": no row to copy capacity from — placeholder ${capacity}, set it in admin.`);
      changes++;
      lines.CATALOG.push(`CREATE   "${entry.name}" [${entry.slug}]  ${entry.kind} ${entry.priceUnit}  ${priceText}`);
      catalogWrites.push({
        entry,
        existingId: null,
        create: { ...fixed, slug: entry.slug, tags: entry.tags, durationMinutes, capacity, archivedAt: null },
        update: null,
        prices: wantedPrices,
      });
      continue;
    }

    const diffs: string[] = [];
    for (const [key, value] of Object.entries(fixed)) {
      const current = (existing as Record<string, unknown>)[key];
      if (current !== value) diffs.push(`${key} ${String(current)} -> ${String(value)}`);
    }
    if (!sameSet(existing.tags, entry.tags)) diffs.push(`tags [${existing.tags.join(", ")}] -> [${entry.tags.join(", ")}]`);
    if (existing.archivedAt !== null) diffs.push("restored from the archive");
    const priceWrites = wantedPrices.filter((p) => {
      const current = existing.locationPrices.find((c) => c.locationId === p.locationId);
      return !current || current.priceCents !== p.priceCents || current.isConfirmed !== p.isConfirmed;
    });
    for (const p of priceWrites) diffs.push(`${studioLabel(p.locationId)} price -> ${money(p.priceCents)}`);

    if (diffs.length === 0) {
      lines.CATALOG.push(`OK       "${entry.name}"  ${priceText}`);
      catalogWrites.push({ entry, existingId: existing.id, create: null, update: null, prices: [] });
      continue;
    }
    changes++;
    lines.CATALOG.push(`UPDATE   "${entry.name}": ${diffs.join("; ")}`);
    catalogWrites.push({
      entry,
      existingId: existing.id,
      create: null,
      update: { ...fixed, tags: entry.tags, archivedAt: null },
      prices: priceWrites,
    });
  }

  type KeepWrite = { id: string; data: Prisma.SessionTypeUncheckedUpdateInput };
  type StaleWrite = { type: SessionType; rule: StaleRule; move: number };
  const keepWrites: KeepWrite[] = [];
  const staleWrites: StaleWrite[] = [];
  const keptActive: SessionType[] = [];
  const review: SessionType[] = [];

  for (const t of types) {
    if (canonicalSlugs.has(t.slug)) continue;
    const n = upcomingByType.get(t.id) ?? 0;

    if (t.isBusyWindow) {
      // A functional internal block. isBusyWindow already keeps it out of
      // every checkout; private keeps it off the public schedule too.
      if (t.isActive && t.archivedAt === null) keptActive.push(t);
      if (t.isPublic) {
        changes++;
        keepWrites.push({ id: t.id, data: { isPublic: false } });
        lines.KEEP.push(`UPDATE   "${t.name}": internal block, isPublic true -> false`);
      } else lines.KEEP.push(`OK       "${t.name}" (internal block, private, never sellable)`);
      continue;
    }

    if (isMemberClass(t)) {
      keptActive.push(t);
      const data: Prisma.SessionTypeUncheckedUpdateInput = {};
      const diffs: string[] = [];
      if (!t.membersOnly) { data.membersOnly = true; diffs.push("membersOnly -> true"); }
      if (!t.isTicketEligible) { data.isTicketEligible = true; diffs.push("isTicketEligible -> true"); }
      if (t.dropInPriceCents !== 0) { data.dropInPriceCents = 0; diffs.push(`price ${money(t.dropInPriceCents)} -> $0.00`); }
      if (!t.isActive) { data.isActive = true; diffs.push("reactivated"); }
      if (t.archivedAt !== null) { data.archivedAt = null; diffs.push("restored from the archive"); }
      if (diffs.length === 0) lines.KEEP.push(`OK       "${t.name}" (members only, 1 ticket)`);
      else {
        changes++;
        keepWrites.push({ id: t.id, data });
        lines.KEEP.push(`UPDATE   "${t.name}": ${diffs.join(", ")}`);
      }
      continue;
    }

    const rule = matchStaleRule(t);
    if (!rule) {
      if (t.isActive && t.archivedAt === null) {
        review.push(t);
        lines.REVIEW.push(`?        "${t.name}" [${t.slug}] ${money(t.dropInPriceCents)}, ${n} upcoming`);
      }
      continue;
    }

    const alreadyArchived = !t.isActive && !t.isTemplate && t.archivedAt !== null;
    const move = rule.target ? n : 0;
    if (alreadyArchived && move === 0) continue;
    changes++;
    staleWrites.push({ type: t, rule, move });

    if (rule.target) {
      const target = CATALOG.find((c) => c.slug === rule.target)!;
      lines.MERGE.push(
        `"${t.name}" -> "${target.name}"  (${rule.why}; ${move} upcoming session${move === 1 ? "" : "s"} moved` +
          `${move > 0 && rule.keepTitle ? ", old name kept as the session title" : ""}` +
          `; ${(totalByType.get(t.id) ?? 0) - move} stay for history)`,
      );
    } else {
      const booked = bookedByType.get(t.id) ?? 0;
      lines.ARCHIVE.push(
        `"${t.name}"  (${rule.why})` +
          (n > 0 ? `  — ${n} upcoming session${n === 1 ? "" : "s"} left in place and hidden${booked ? `, ${booked} with confirmed bookings` : ""}` : ""),
      );
    }
  }

  const section = (title: string, rows: string[]) => {
    console.log(`\n${title}`);
    if (rows.length === 0) console.log("  (nothing to do)");
    for (const row of rows) console.log(`  ${row}`);
  };
  section("CATALOG (canonical class types)", lines.CATALOG);
  section("KEEP (member classes and the internal block)", lines.KEEP);
  section("MERGE (upcoming sessions move, then the type is archived; past sessions are not touched)", lines.MERGE);
  section("ARCHIVE (isActive=false, isTemplate=false, archivedAt=now; nothing deleted)", lines.ARCHIVE);
  if (lines.REVIEW.length > 0) section("REVIEW (active, not in the catalog, left untouched)", lines.REVIEW);
  if (lines.NOTES.length > 0) section("NOTES", lines.NOTES);

  // ── AFTER ─────────────────────────────────────────────────────────────────
  const after = [
    ...CATALOG.map((c) => {
      const prices = c.locationPrices
        .filter((p) => studioId[p.studio])
        .map((p) => `${p.studio === "LEHI" ? "Lehi" : "Provo"} ${money(p.priceCents)}`)
        .join(", ");
      const flags = [
        c.kind,
        c.priceUnit,
        c.isTicketEligible ? "ticket eligible" : "no tickets",
        c.isPublic ? "public" : "private",
        ...(c.membersOnly ? ["members only"] : []),
      ].join(", ");
      const price = prices || money(c.dropInPriceCents);
      return `${c.name}  [${c.slug}]  ${price}${c.memberPriceCents !== null ? ` (members ${money(c.memberPriceCents)})` : ""}  ${flags}`;
    }),
    ...keptActive.map((t) => `${t.name}  [${t.slug}]  ${t.isBusyWindow ? "internal block, private, never sellable" : "members only, 1 ticket"}`),
    ...review.map((t) => `${t.name}  [${t.slug}]  ${money(t.dropInPriceCents)}  REVIEW`),
  ];
  console.log(`\nAFTER — ${after.length} active class types`);
  for (const row of after) console.log(`  ${row}`);

  const archived = staleWrites.length;
  const moved = staleWrites.reduce((sum, s) => sum + s.move, 0);

  if (changes === 0) {
    console.log("\nNo changes — the class types already match the catalog.");
    return;
  }

  if (!APPLY) {
    console.log(
      `\nPlan: ${lines.CATALOG.filter((l) => !l.startsWith("OK")).length} catalog writes, ` +
        `${keepWrites.length} kept types updated, ${archived} types archived, ${moved} upcoming sessions moved.`,
    );
    console.log("Dry run only — re-run with --apply to write these changes.");
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  let movedForReal = 0;
  await prisma.$transaction(
    async (tx) => {
      const idBySlug = new Map<string, string>();
      for (const w of catalogWrites) {
        let id = w.existingId;
        if (w.create) id = (await tx.sessionType.create({ data: w.create })).id;
        else if (w.update) await tx.sessionType.update({ where: { id: id! }, data: w.update });
        idBySlug.set(w.entry.slug, id!);
        for (const p of w.prices) {
          await tx.sessionTypeLocationPrice.upsert({
            where: { sessionTypeId_locationId: { sessionTypeId: id!, locationId: p.locationId } },
            create: { sessionTypeId: id!, ...p },
            update: { priceCents: p.priceCents, isConfirmed: p.isConfirmed },
          });
        }
      }

      for (const k of keepWrites) await tx.sessionType.update({ where: { id: k.id }, data: k.data });

      for (const { type, rule } of staleWrites) {
        const targetId = rule.target ? idBySlug.get(rule.target) : undefined;
        if (targetId) {
          const upcomingHere = { sessionTypeId: type.id, startsAt: { gte: NOW }, isCancelled: false };
          if (rule.keepTitle) {
            // Never overwrite a title staff already gave the session.
            const titled = await tx.studioSession.updateMany({
              where: { ...upcomingHere, title: null },
              data: { sessionTypeId: targetId, title: type.name },
            });
            movedForReal += titled.count;
          }
          const rest = await tx.studioSession.updateMany({
            where: upcomingHere,
            data: { sessionTypeId: targetId },
          });
          movedForReal += rest.count;
        }
        await tx.sessionType.update({
          where: { id: type.id },
          data: { isActive: false, isTemplate: false, archivedAt: type.archivedAt ?? NOW },
        });
      }
    },
    { maxWait: 20_000, timeout: 180_000 },
  );

  console.log(
    `\nApplied: ${lines.CATALOG.filter((l) => !l.startsWith("OK")).length} catalog writes, ` +
      `${keepWrites.length} kept types updated, ${archived} types archived, ${movedForReal} upcoming sessions moved.`,
  );

  const activeNow = await prisma.sessionType.count({ where: { isActive: true, archivedAt: null } });
  console.log(`Active class types now: ${activeNow}${activeNow === after.length ? "" : ` (expected ${after.length} — check the lists above)`}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
