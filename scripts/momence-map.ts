// Pure transform: reads momence-export/*.json and produces the exact rows
// we would insert into our schema, without touching the database. Review
// momence-export/mapped/report.json before running any import step.
//
// Run with:
//   npm run momence:map
import fs from "fs";
import path from "path";

const EXPORT_DIR = path.join(__dirname, "..", "momence-export");
const OUT_DIR = path.join(EXPORT_DIR, "mapped");

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, `${name}.json`), "utf8"));
}

function writeJson(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// Our two existing Locations (from Location.findMany() against the target DB).
// Momence resource sub-locations ("Pottery Wheel 1"..."Pottery Wheel 10") are
// physical stations inside the Provo studio — Lehi has no wheel inventory yet
// per the Lehi preorder work, so they all map to Provo. Flagged in the report.
const OUR_LOCATION = {
  PROVO: "cmphmu63k0009owhcb64gluxc",
  LEHI: "cmt5ap6ja0004ky0458x4um0i",
} as const;

const MOMENCE_LOCATION_TO_OURS: Record<number, string> = {
  55591: OUR_LOCATION.PROVO, // "Provo - Throw Art Studio"
  148062: OUR_LOCATION.LEHI, // "Lehi - Throw Art Studio"
  59919: OUR_LOCATION.PROVO, // Pottery Wheel 1
  59920: OUR_LOCATION.PROVO, // Pottery Wheel 2
  59921: OUR_LOCATION.PROVO, // Pottery Wheel 3
  59922: OUR_LOCATION.PROVO, // Pottery Wheel 4
  59923: OUR_LOCATION.PROVO, // Pottery Wheel 5
  59924: OUR_LOCATION.PROVO, // Pottery Wheel 6
  59925: OUR_LOCATION.PROVO, // Pottery Wheel 7
  59926: OUR_LOCATION.PROVO, // Pottery Wheel 8
  59927: OUR_LOCATION.PROVO, // Pottery Wheel 9
  59928: OUR_LOCATION.PROVO, // Pottery Wheel 10
};

type MomenceMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  firstSeen: string;
};

// A handful of Momence "sessions" (e.g. "Pay for Pottery Pieces", used as a
// payment mechanism rather than a real bookable class) have capacity: null.
// SessionType/StudioSession.capacity is a required Int with no "unlimited"
// representation, so null becomes this sentinel. Flagged in the report.
const UNLIMITED_CAPACITY_SENTINEL = 999;

type MomenceSession = {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  durationInMinutes: number;
  capacity: number | null;
  teacher: { id: number; firstName: string; lastName: string } | null;
  isCancelled: boolean;
  inPersonLocation: { id: number; name: string } | null;
};

type MomenceSessionBooking = {
  id: number;
  member: { id: number; email: string | null } | null;
  createdAt: string;
  cancelledAt: string | null;
};

type MomenceAppointment = {
  id: number;
  createdAt: string;
  cancelledAt: string | null;
  startsAt: string;
  endsAt: string;
  durationInMinutes: number;
  capacity: number;
  service: { id: number; name: string } | null;
  inPersonLocation: { id: number; name: string } | null;
  appointmentAttendees: {
    id: number;
    memberId: number;
    attendanceStatus: string;
    bookedAt: string;
    cancelledAt: string | null;
  }[];
};

type MomenceBoughtMembership = {
  id: number;
  startDate: string | null;
  endDate: string | null;
  isFrozen: boolean;
  usageLimitForSessions: number | null;
  usedSessions: number | null;
  declinedRenewal: unknown;
  membership: { id: number; name: string };
};

type CatalogMembership = {
  id: number;
  name: string;
  type: string;
  price: number; // dollars
  isDeleted: boolean;
  isDisabled: boolean;
};

type CatalogEvent = {
  id: number;
  fixedPrice: number; // dollars
};

const report = {
  generatedAt: new Date().toISOString(),
  locations: { unmappedMomenceLocationIds: [] as number[] },
  sessionTypes: { count: 0, nullCapacitySessions: 0 },
  users: {
    total: 0,
    imported: 0,
    skippedNoEmail: 0,
    duplicateEmailsCollapsed: 0,
  },
  studioSessions: {
    fromSessions: 0,
    fromAppointments: 0,
    unresolvedSessionType: 0,
  },
  bookings: {
    fromSessionBookings: 0,
    fromAppointmentAttendees: 0,
    skippedNoMemberEmail: 0,
    skippedUnresolvedSession: 0,
    // KNOWN GAP: the /sales endpoint returned 403 (needs Momence support to
    // enable it for this account), so no historical payment amounts exist
    // anywhere in this export. Every imported booking gets amountPaidCents:0
    // and source: "DROP_IN" as a placeholder — neither reflects reality and
    // both should be revisited once real payment history is available.
    allDefaultedToDropInZeroAmount: true,
  },
  membershipPlans: {
    total: 0,
    resolvedFromCatalog: 0,
    resolvedFromEmbedded: 0,
    // Momence itself leaves isDeleted/isDisabled false on plans it has
    // renamed with an "OLD - " prefix, so our isActive derivation (which
    // trusts those flags) reports them active too. Not auto-corrected —
    // confirm with the studio whether these should be deactivated.
    activeButNamedOld: [] as string[],
  },
  memberships: {
    total: 0,
    skippedNullPeriod: 0,
    skippedNoMemberEmail: 0,
    imported: 0,
  },
  caveats: [
    "Booking.source is a required enum with no equivalent field in Momence's export; every imported booking defaults to DROP_IN with amountPaidCents 0. Revisit once /sales is enabled.",
    "Instructor/teacher matching skipped entirely: Momence teacher records (sessions + catalog-teachers) carry no email, so StudioSession.instructorId is left null for all imported rows rather than guessed by name.",
    "Pottery Wheel 1-10 resource locations are all mapped to the Provo Location — Lehi has no wheel inventory yet (still in preorder stage per recent commits). Revisit if that changes.",
    "bought-memberships with a null startDate/endDate (the large majority — only ~360 of 7,705 members have any bought-membership record at all, per the export) are skipped rather than fabricating a period; see memberships.skippedNullPeriod.",
    `Sessions with capacity: null in Momence's export (e.g. "Pay for Pottery Pieces", a payment mechanism rather than a real class) get a ${UNLIMITED_CAPACITY_SENTINEL} sentinel capacity — see sessionTypes.nullCapacitySessions.`,
  ],
};

function main() {
  const members = readJson<MomenceMember[]>("members");
  const sessions = readJson<MomenceSession[]>("sessions");
  const sessionBookings = readJson<Record<string, MomenceSessionBooking[]>>("session-bookings");
  const appointments = readJson<MomenceAppointment[]>("appointments");
  const boughtMemberships = readJson<Record<string, MomenceBoughtMembership[]>>("bought-memberships");
  const catalogMemberships = readJson<CatalogMembership[]>("catalog-memberships");
  const catalogEvents = readJson<CatalogEvent[]>("catalog-events");

  // -------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------
  const usersByEmail = new Map<string, ReturnType<typeof mapUser>>();
  let skippedNoEmail = 0;
  let duplicatesCollapsed = 0;

  function mapUser(m: MomenceMember) {
    return {
      id: `mu_${m.id}`,
      momenceMemberId: m.id,
      email: m.email!.trim().toLowerCase(),
      name: `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || null,
      phone: m.phoneNumber,
      role: "CUSTOMER" as const,
      createdAt: m.firstSeen,
    };
  }

  // member id -> User.id, for resolving FKs on bookings/memberships below.
  // Kept separate from memberIdToEmail so a duplicate-email collapse doesn't
  // silently point two Momence member ids at two different User rows.
  const memberIdToUserId = new Map<number, string>();

  for (const m of members) {
    if (!m.email) {
      skippedNoEmail++;
      continue;
    }
    const key = m.email.trim().toLowerCase();
    const existing = usersByEmail.get(key);
    if (existing) {
      duplicatesCollapsed++;
      memberIdToUserId.set(m.id, existing.id);
      continue;
    }
    const row = mapUser(m);
    usersByEmail.set(key, row);
    memberIdToUserId.set(m.id, row.id);
  }

  report.users.total = members.length;
  report.users.imported = usersByEmail.size;
  report.users.skippedNoEmail = skippedNoEmail;
  report.users.duplicateEmailsCollapsed = duplicatesCollapsed;

  // -------------------------------------------------------------------
  // Session types (derived from distinct class-session names) + one from
  // each distinct appointment service name.
  // -------------------------------------------------------------------
  type SessionTypeRow = {
    id: string;
    slug: string;
    name: string;
    durationMinutes: number;
    capacity: number;
    dropInPriceCents: number;
    isBusyWindow: boolean;
    locationId: string | null;
    sourceSessionIds: number[]; // internal only, trimmed to a count before writing
  };
  const sessionTypesByName = new Map<string, SessionTypeRow>();

  // session id -> catalog fixedPrice (dollars), for backfilling dropInPriceCents
  const eventPriceById = new Map<number, number>();
  for (const e of catalogEvents) eventPriceById.set(e.id, e.fixedPrice);

  for (const s of sessions) {
    const name = s.name.trim();
    const locationId = s.inPersonLocation
      ? MOMENCE_LOCATION_TO_OURS[s.inPersonLocation.id] ?? null
      : null;
    if (s.inPersonLocation && locationId === null) {
      report.locations.unmappedMomenceLocationIds.push(s.inPersonLocation.id);
    }

    if (s.capacity === null) report.sessionTypes.nullCapacitySessions++;

    let row = sessionTypesByName.get(name);
    if (!row) {
      const price = eventPriceById.get(s.id);
      const slug = slugify(name);
      row = {
        id: `mst_${slug}`,
        slug,
        name,
        durationMinutes: s.durationInMinutes,
        capacity: s.capacity ?? UNLIMITED_CAPACITY_SENTINEL,
        dropInPriceCents: price !== undefined ? Math.round(price * 100) : 0,
        isBusyWindow: /busy window/i.test(name),
        locationId,
        sourceSessionIds: [],
      };
      sessionTypesByName.set(name, row);
    }
    row.sourceSessionIds.push(s.id);
  }

  for (const a of appointments) {
    const name = a.service?.name ?? "Momence Appointment";
    let row = sessionTypesByName.get(name);
    if (!row) {
      const slug = slugify(name);
      row = {
        id: `mst_${slug}`,
        slug,
        name,
        durationMinutes: a.durationInMinutes,
        capacity: a.capacity,
        dropInPriceCents: 0,
        isBusyWindow: false,
        locationId: a.inPersonLocation
          ? MOMENCE_LOCATION_TO_OURS[a.inPersonLocation.id] ?? OUR_LOCATION.PROVO
          : OUR_LOCATION.PROVO,
        sourceSessionIds: [],
      };
      sessionTypesByName.set(name, row);
    }
  }

  const sessionTypeIdByMomenceSessionId = new Map<number, string>();
  for (const row of sessionTypesByName.values()) {
    for (const sourceId of row.sourceSessionIds) sessionTypeIdByMomenceSessionId.set(sourceId, row.id);
  }
  const sessionTypeIdByServiceName = new Map<string, string>();
  for (const row of sessionTypesByName.values()) sessionTypeIdByServiceName.set(row.name, row.id);

  report.sessionTypes.count = sessionTypesByName.size;

  // -------------------------------------------------------------------
  // StudioSessions: one per Momence session occurrence, one per appointment.
  // -------------------------------------------------------------------
  type StudioSessionRow = {
    id: string; // "mss_session_<id>" | "mss_appt_<id>"
    sessionTypeId: string;
    locationId: string | null;
    startsAt: string;
    endsAt: string;
    capacity: number;
    isCancelled: boolean;
  };
  const studioSessions: StudioSessionRow[] = [];

  for (const s of sessions) {
    const sessionTypeId = sessionTypeIdByMomenceSessionId.get(s.id);
    if (!sessionTypeId) {
      report.studioSessions.unresolvedSessionType++;
      continue;
    }
    studioSessions.push({
      id: `mss_session_${s.id}`,
      sessionTypeId,
      locationId: s.inPersonLocation
        ? MOMENCE_LOCATION_TO_OURS[s.inPersonLocation.id] ?? null
        : null,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      capacity: s.capacity ?? UNLIMITED_CAPACITY_SENTINEL,
      isCancelled: s.isCancelled,
    });
    report.studioSessions.fromSessions++;
  }

  for (const a of appointments) {
    const name = a.service?.name ?? "Momence Appointment";
    const sessionTypeId = sessionTypeIdByServiceName.get(name)!;
    studioSessions.push({
      id: `mss_appt_${a.id}`,
      sessionTypeId,
      locationId: a.inPersonLocation
        ? MOMENCE_LOCATION_TO_OURS[a.inPersonLocation.id] ?? OUR_LOCATION.PROVO
        : OUR_LOCATION.PROVO,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      capacity: a.capacity,
      isCancelled: a.cancelledAt !== null,
    });
    report.studioSessions.fromAppointments++;
  }

  // -------------------------------------------------------------------
  // Bookings: session-bookings + appointment attendees.
  // -------------------------------------------------------------------
  type BookingRow = {
    id: string;
    userId: string;
    studioSessionId: string;
    status: "CONFIRMED" | "CANCELLED";
    source: "DROP_IN";
    amountPaidCents: 0;
    createdAt: string;
    cancelledAt: string | null;
  };
  const bookings: BookingRow[] = [];

  for (const [sessionIdStr, sessionBookingsForSession] of Object.entries(sessionBookings)) {
    const sessionId = Number(sessionIdStr);
    const studioSessionId = `mss_session_${sessionId}`;
    const sessionTypeId = sessionTypeIdByMomenceSessionId.get(sessionId);
    for (const b of sessionBookingsForSession) {
      const userId = memberIdToUserId.get(b.member?.id ?? -1);
      if (!userId) {
        report.bookings.skippedNoMemberEmail++;
        continue;
      }
      if (!sessionTypeId) {
        report.bookings.skippedUnresolvedSession++;
        continue;
      }
      bookings.push({
        id: `mbk_sb_${b.id}`,
        userId,
        studioSessionId,
        status: b.cancelledAt ? "CANCELLED" : "CONFIRMED",
        source: "DROP_IN",
        amountPaidCents: 0,
        createdAt: b.createdAt,
        cancelledAt: b.cancelledAt,
      });
      report.bookings.fromSessionBookings++;
    }
  }

  for (const a of appointments) {
    const studioSessionId = `mss_appt_${a.id}`;
    for (const attendee of a.appointmentAttendees) {
      const userId = memberIdToUserId.get(attendee.memberId);
      if (!userId) {
        report.bookings.skippedNoMemberEmail++;
        continue;
      }
      bookings.push({
        id: `mbk_ap_${attendee.id}`,
        userId,
        studioSessionId,
        status: attendee.cancelledAt ? "CANCELLED" : "CONFIRMED",
        source: "DROP_IN",
        amountPaidCents: 0,
        createdAt: attendee.bookedAt,
        cancelledAt: attendee.cancelledAt,
      });
      report.bookings.fromAppointmentAttendees++;
    }
  }

  // -------------------------------------------------------------------
  // Membership plans (from the widget catalog).
  // -------------------------------------------------------------------
  type PlanRow = {
    id: string;
    momenceId: number;
    slug: string;
    name: string;
    price: number; // cents
    isActive: boolean;
  };
  const plansById = new Map<number, PlanRow>();
  for (const cm of catalogMemberships) {
    plansById.set(cm.id, {
      id: `mmp_${cm.id}`,
      momenceId: cm.id,
      slug: slugify(`${cm.name}-${cm.id}`), // catalog has near-duplicate names ("OLD - ..."), disambiguate with id
      name: cm.name.trim(),
      price: Math.round(cm.price * 100),
      isActive: !cm.isDeleted && !cm.isDisabled,
    });
  }

  // -------------------------------------------------------------------
  // Memberships (bought-memberships), one row per purchase.
  // -------------------------------------------------------------------
  type MembershipRow = {
    id: string;
    userId: string;
    planId: string;
    status: "ACTIVE" | "PAUSED" | "CANCELLED";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    creditsRemaining: number;
    pausedAt: string | null;
  };
  const membershipRows: MembershipRow[] = [];
  let embeddedPlansResolved = 0;
  let catalogPlansResolved = 0;
  let totalBought = 0;
  let skippedNullPeriod = 0;
  let skippedNoEmailForMembership = 0;

  for (const [memberIdStr, purchases] of Object.entries(boughtMemberships)) {
    const memberId = Number(memberIdStr);
    const userId = memberIdToUserId.get(memberId);
    for (const p of purchases) {
      totalBought++;
      if (!userId) {
        skippedNoEmailForMembership++;
        continue;
      }
      if (!p.startDate || !p.endDate) {
        skippedNullPeriod++;
        continue;
      }
      if (!plansById.has(p.membership.id)) {
        // Embedded plan wasn't in the widget catalog (e.g. a legacy/hidden
        // plan) — synthesize a MembershipPlan row from the embedded data so
        // Membership.planId still resolves to something real.
        plansById.set(p.membership.id, {
          id: `mmp_${p.membership.id}`,
          momenceId: p.membership.id,
          slug: slugify(`${p.membership.name}-${p.membership.id}`),
          name: p.membership.name.trim(),
          price: 0,
          isActive: false,
        });
        embeddedPlansResolved++;
      } else {
        catalogPlansResolved++;
      }

      const creditsRemaining =
        p.usageLimitForSessions !== null && p.usedSessions !== null
          ? Math.max(0, p.usageLimitForSessions - p.usedSessions)
          : 0;

      membershipRows.push({
        id: `mm_${p.id}`,
        userId,
        planId: `mmp_${p.membership.id}`,
        status: p.isFrozen ? "PAUSED" : p.declinedRenewal ? "CANCELLED" : "ACTIVE",
        currentPeriodStart: p.startDate,
        currentPeriodEnd: p.endDate,
        creditsRemaining,
        pausedAt: p.isFrozen ? p.startDate : null,
      });
    }
  }

  report.membershipPlans.total = plansById.size;
  report.membershipPlans.resolvedFromCatalog = catalogPlansResolved;
  report.membershipPlans.resolvedFromEmbedded = embeddedPlansResolved;
  report.memberships.total = totalBought;
  report.memberships.skippedNullPeriod = skippedNullPeriod;
  report.memberships.skippedNoMemberEmail = skippedNoEmailForMembership;
  report.memberships.imported = membershipRows.length;

  // -------------------------------------------------------------------
  // Write everything out for review.
  // -------------------------------------------------------------------
  for (const plan of plansById.values()) {
    if (plan.isActive && /^old\b/i.test(plan.name)) {
      report.membershipPlans.activeButNamedOld.push(`${plan.name} (${plan.momenceId})`);
    }
  }

  writeJson("users", [...usersByEmail.values()]);
  writeJson(
    "session-types",
    [...sessionTypesByName.values()].map(({ sourceSessionIds, ...rest }) => ({
      ...rest,
      sessionCount: sourceSessionIds.length,
    }))
  );
  writeJson("studio-sessions", studioSessions);
  writeJson("bookings", bookings);
  writeJson("membership-plans", [...plansById.values()]);
  writeJson("memberships", membershipRows);
  writeJson("report", report);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote mapped rows to ${OUT_DIR}`);
  console.log("No database writes were made. Review report.json before running an import.");
}

main();
