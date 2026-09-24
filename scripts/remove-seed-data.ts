// Removes what prisma/seed.ts left in the production database, leaving real
// (Momence-imported and live) data alone. Dry run by default: prints what it
// would delete and anything that stops it. Pass --apply to write.
//
//   npx tsx --tsconfig tsconfig.json scripts/remove-seed-data.ts [--apply]
//
// Seed fingerprint (verified on production 2026-09-24):
//   users        the @example.com demo customers, test@ accounts, and the
//                demo staff logins maya/diego/frontdesk/staff@throw.studio.
//                NEVER admin@throw.studio: that is JP's real admin login.
//   class types  open-studio, busy-window-open-studio, wheel-throwing-101,
//                hand-building-workshop (and their sessions)
//   community    3 posts by admin/maya/diego, plus seed likes and comments
//   staff tasks  the 8 seed tasks, matched by title
//   roles        Manager / Instructor / Front Desk at Provo stay (they are
//                real config); only the seed users' assignments go
//
// Refuses to proceed (and says why) when real data points at seed rows:
// a non-seed booking on a seed session, a POS order or conversation or piece
// belonging to a seed user, a seed staff user instructing a session that has
// real bookings.

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const SEED_EMAILS = [
  "sarah@example.com", "mike@example.com", "priya@example.com", "jordan@example.com", "claire@example.com",
  "test@example.com", "test@gmail.com",
  "maya@throw.studio", "diego@throw.studio", "frontdesk@throw.studio", "staff@throw.studio",
];
const KEEP_EMAIL = "admin@throw.studio";
const SEED_TYPE_SLUGS = ["open-studio", "busy-window-open-studio", "wheel-throwing-101", "hand-building-workshop"];
const SEED_PLAN_SLUGS = ["expert-monthly", "pro-monthly", "basic-monthly", "pro-3-month", "pro-12-month"];
const SEED_POST_TITLES = ["Welcome to the Throw Community!", "Kiln Firing This Weekend"];
const SEED_TASK_TITLES = [
  "Follow up with Claire re: no-show policy", "Restock clay — Studio A running low",
  "Check kiln temperature log for last firing", "Send monthly newsletter draft to JohnPaul for review",
  "Set up new member orientation packet", "Order new trimming tools",
  "Update studio hours on front door signage", "Deep clean wheel throwing room",
];

function log(line: string) { console.log(line); }

async function main() {
  if (SEED_EMAILS.includes(KEEP_EMAIL)) throw new Error("refusing: admin login is in the seed list");
  const users = await prisma.user.findMany({ where: { email: { in: SEED_EMAILS } }, select: { id: true, email: true, role: true } });
  const userIds = users.map((u) => u.id);
  log(`seed users found: ${users.map((u) => u.email).join(", ") || "(none)"}`);

  const types = await prisma.sessionType.findMany({ where: { slug: { in: SEED_TYPE_SLUGS } }, select: { id: true, slug: true } });
  const typeIds = types.map((t) => t.id);
  const seedSessions = await prisma.studioSession.findMany({ where: { sessionTypeId: { in: typeIds } }, select: { id: true } });
  const seedSessionIds = seedSessions.map((s) => s.id);
  log(`seed class types: ${types.map((t) => t.slug).join(", ") || "(none)"}; their sessions: ${seedSessionIds.length}`);

  // ---- blockers: real data hanging off seed rows ----
  const blockers: string[] = [];
  const realBookingsOnSeedSessions = await prisma.booking.count({ where: { studioSessionId: { in: seedSessionIds }, userId: { notIn: userIds } } });
  if (realBookingsOnSeedSessions) blockers.push(`${realBookingsOnSeedSessions} booking(s) by real users on seed sessions`);
  const posOrders = await prisma.posOrder.count({ where: { OR: [{ customerId: { in: userIds } }, { staffId: { in: userIds } }] } });
  if (posOrders) blockers.push(`${posOrders} POS order(s) by seed users`);
  const conversations = await prisma.conversation.count({ where: { userId: { in: userIds } } }).catch(() => 0);
  if (conversations) blockers.push(`${conversations} conversation(s) with seed users`);
  const pieces = await prisma.piece.count({ where: { OR: [{ userId: { in: userIds } }, { studioSessionId: { in: seedSessionIds } }] } });
  if (pieces) blockers.push(`${pieces} piece(s) owned by seed users or logged against seed sessions`);
  const instructedReal = await prisma.studioSession.count({ where: { instructorId: { in: userIds }, sessionTypeId: { notIn: typeIds }, bookings: { some: { userId: { notIn: userIds } } } } });
  const instructedAny = await prisma.studioSession.count({ where: { instructorId: { in: userIds }, sessionTypeId: { notIn: typeIds } } });
  if (instructedAny) log(`note: seed staff are instructor on ${instructedAny} real session(s) (${instructedReal} with real bookings); instructor will be cleared, sessions kept`);
  const discountCodes = await prisma.discountCode.count({ where: { sessionTypeId: { in: typeIds } } });
  if (discountCodes) blockers.push(`${discountCodes} discount code(s) tied to seed class types`);

  // ---- what goes ----
  const memberships = await prisma.membership.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const membershipIds = memberships.map((m) => m.id);
  const counts = {
    bookings: await prisma.booking.count({ where: { OR: [{ userId: { in: userIds } }, { studioSessionId: { in: seedSessionIds } }] } }),
    payments: await prisma.payment.count({ where: { userId: { in: userIds } } }),
    tips: await prisma.tip.count({ where: { OR: [{ customerId: { in: userIds } }, { instructorId: { in: userIds } }] } }),
    adTracking: await prisma.adTracking.count({ where: { userId: { in: userIds } } }),
    waiverSignatures: await prisma.waiverSignature.count({ where: { userId: { in: userIds } } }),
    memberships: membershipIds.length,
    membershipEvents: await prisma.membershipEvent.count({ where: { membershipId: { in: membershipIds } } }),
    creditLedger: await prisma.membershipCreditLedger.count({ where: { membershipId: { in: membershipIds } } }),
    addOns: await prisma.membershipAddOnAssignment.count({ where: { membershipId: { in: membershipIds } } }),
    shelfWaitlist: await prisma.shelfWaitlistEntry.count({ where: { membershipId: { in: membershipIds } } }),
    shelvesToFree: await prisma.shelfSpace.count({ where: { membershipId: { in: membershipIds } } }),
    roleAssignments: await prisma.staffRoleAssignment.count({ where: { userId: { in: userIds } } }),
    payRates: await prisma.payRate.count({ where: { userId: { in: userIds } } }).catch(() => 0),
    classCredit: await prisma.classCreditLedger.count({ where: { userId: { in: userIds } } }).catch(() => 0),
    discountRedemptions: await prisma.discountRedemption.count({ where: { userId: { in: userIds } } }).catch(() => 0),
    likes: await prisma.communityLike.count({ where: { userId: { in: userIds } } }),
    comments: await prisma.communityComment.count({ where: { authorId: { in: userIds } } }),
    posts: await prisma.communityPost.count({ where: { OR: [{ authorId: { in: userIds } }, { title: { in: SEED_POST_TITLES } }] } }),
    tasks: await prisma.staffTask.count({ where: { OR: [{ assignedToId: { in: userIds } }, { linkedCustomerId: { in: userIds } }, { title: { in: SEED_TASK_TITLES } }] } }),
    sessions: seedSessionIds.length,
    typePrices: await prisma.sessionTypeLocationPrice.count({ where: { sessionTypeId: { in: typeIds } } }),
    typeWaivers: await prisma.waiverSessionType.count({ where: { sessionTypeId: { in: typeIds } } }),
    types: typeIds.length,
    plans: await prisma.membershipPlan.count({ where: { slug: { in: SEED_PLAN_SLUGS }, memberships: { none: {} } } }),
    users: userIds.length,
  };
  log("would delete: " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" "));
  const otherTasks = await prisma.staffTask.findMany({ where: { NOT: { title: { in: SEED_TASK_TITLES } }, assignedToId: { notIn: userIds } }, select: { title: true, createdBy: { select: { email: true } } } });
  if (otherTasks.length) log(`tasks kept (not recognised as seed): ${otherTasks.map((t) => `"${t.title}" by ${t.createdBy.email}`).join("; ")}`);

  if (blockers.length) {
    log("BLOCKED, nothing written:\n  - " + blockers.join("\n  - "));
    process.exitCode = 1;
    return;
  }
  if (!APPLY) { log("dry run. Re-run with --apply to delete."); return; }

  await prisma.$transaction(async (tx) => {
    await tx.studioSession.updateMany({ where: { instructorId: { in: userIds } }, data: { instructorId: null } });
    await tx.piece.updateMany({ where: { loggedById: { in: userIds } }, data: { loggedById: null } });
    await tx.tip.deleteMany({ where: { OR: [{ customerId: { in: userIds } }, { instructorId: { in: userIds } }] } });
    await tx.payment.deleteMany({ where: { userId: { in: userIds } } });
    await tx.adTracking.deleteMany({ where: { userId: { in: userIds } } });
    await tx.booking.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { studioSessionId: { in: seedSessionIds } }] } });
    await tx.waiverSignature.deleteMany({ where: { userId: { in: userIds } } });
    await tx.shelfSpace.updateMany({ where: { membershipId: { in: membershipIds } }, data: { membershipId: null } });
    await tx.shelfWaitlistEntry.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await tx.membershipAddOnAssignment.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await tx.membershipCreditLedger.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await tx.membershipEvent.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await tx.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await tx.staffRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
    await tx.payRate.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await tx.classCreditLedger.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await tx.discountRedemption.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await tx.communityLike.deleteMany({ where: { userId: { in: userIds } } });
    await tx.communityComment.deleteMany({ where: { authorId: { in: userIds } } });
    await tx.communityPost.deleteMany({ where: { OR: [{ authorId: { in: userIds } }, { title: { in: SEED_POST_TITLES } }] } }); // likes/comments cascade
    await tx.staffTask.deleteMany({ where: { OR: [{ assignedToId: { in: userIds } }, { linkedCustomerId: { in: userIds } }, { title: { in: SEED_TASK_TITLES } }] } });
    await tx.studioSession.deleteMany({ where: { id: { in: seedSessionIds } } });
    await tx.sessionTypeLocationPrice.deleteMany({ where: { sessionTypeId: { in: typeIds } } });
    await tx.waiverSessionType.deleteMany({ where: { sessionTypeId: { in: typeIds } } });
    await tx.sessionType.deleteMany({ where: { id: { in: typeIds } } });
    await tx.membershipPlan.deleteMany({ where: { slug: { in: SEED_PLAN_SLUGS }, memberships: { none: {} } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } }); // accounts/sessions cascade
  });
  log("done.");
}

main().finally(() => prisma.$disconnect());
