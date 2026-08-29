// Writes the rows produced by scripts/momence-map.ts into the database.
// Every row carries a deterministic id derived from its Momence source
// (e.g. "mu_<momenceMemberId>" for a User), so this is safe to re-run:
// createMany's skipDuplicates just no-ops on anything already loaded.
//
// Run momence:map first and review momence-export/mapped/report.json —
// this script performs no mapping decisions of its own, only writes.
//
// Run with:
//   npm run momence:apply
import fs from "fs";
import path from "path";
import { PrismaClient, Role, BookingStatus, BookingSource, MembershipStatus } from "@prisma/client";

const MAPPED_DIR = path.join(__dirname, "..", "momence-export", "mapped");
const CHUNK_SIZE = 1000;

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(MAPPED_DIR, `${name}.json`), "utf8"));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const prisma = new PrismaClient();

async function main() {
  const users = readJson<
    { id: string; email: string; name: string | null; phone: string | null; createdAt: string }[]
  >("users");
  const sessionTypes = readJson<
    {
      id: string;
      slug: string;
      name: string;
      durationMinutes: number;
      capacity: number;
      dropInPriceCents: number;
      isBusyWindow: boolean;
      locationId: string | null;
    }[]
  >("session-types");
  const membershipPlans = readJson<
    { id: string; slug: string; name: string; price: number; isActive: boolean }[]
  >("membership-plans");
  const studioSessions = readJson<
    {
      id: string;
      sessionTypeId: string;
      locationId: string | null;
      startsAt: string;
      endsAt: string;
      capacity: number;
      isCancelled: boolean;
    }[]
  >("studio-sessions");
  const bookings = readJson<
    {
      id: string;
      userId: string;
      studioSessionId: string;
      status: "CONFIRMED" | "CANCELLED";
      source: "DROP_IN";
      amountPaidCents: 0;
      createdAt: string;
      cancelledAt: string | null;
    }[]
  >("bookings");
  const memberships = readJson<
    {
      id: string;
      userId: string;
      planId: string;
      status: "ACTIVE" | "PAUSED" | "CANCELLED";
      currentPeriodStart: string;
      currentPeriodEnd: string;
      creditsRemaining: number;
      pausedAt: string | null;
    }[]
  >("memberships");

  console.log(`Loading ${membershipPlans.length} membership plans...`);
  for (const batch of chunk(membershipPlans, CHUNK_SIZE)) {
    await prisma.membershipPlan.createMany({
      skipDuplicates: true,
      data: batch.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        billingIntervalDays: 30, // unknown from Momence catalog; revisit if billing cadence matters downstream
        isActive: p.isActive,
      })),
    });
  }

  console.log(`Loading ${sessionTypes.length} session types...`);
  for (const batch of chunk(sessionTypes, CHUNK_SIZE)) {
    await prisma.sessionType.createMany({
      skipDuplicates: true,
      data: batch.map((st) => ({
        id: st.id,
        name: st.name,
        slug: st.slug,
        durationMinutes: st.durationMinutes,
        capacity: st.capacity,
        dropInPriceCents: st.dropInPriceCents,
        isBusyWindow: st.isBusyWindow,
        locationId: st.locationId,
      })),
    });
  }

  console.log(`Loading ${users.length} users...`);
  for (const batch of chunk(users, CHUNK_SIZE)) {
    await prisma.user.createMany({
      skipDuplicates: true,
      data: batch.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: Role.CUSTOMER,
        createdAt: new Date(u.createdAt),
      })),
    });
  }

  console.log(`Loading ${studioSessions.length} studio sessions...`);
  for (const batch of chunk(studioSessions, CHUNK_SIZE)) {
    await prisma.studioSession.createMany({
      skipDuplicates: true,
      data: batch.map((ss) => ({
        id: ss.id,
        sessionTypeId: ss.sessionTypeId,
        locationId: ss.locationId,
        startsAt: new Date(ss.startsAt),
        endsAt: new Date(ss.endsAt),
        capacity: ss.capacity,
        isCancelled: ss.isCancelled,
      })),
    });
  }

  console.log(`Loading ${bookings.length} bookings...`);
  for (const batch of chunk(bookings, CHUNK_SIZE)) {
    await prisma.booking.createMany({
      skipDuplicates: true,
      data: batch.map((b) => ({
        id: b.id,
        userId: b.userId,
        studioSessionId: b.studioSessionId,
        status: b.status === "CANCELLED" ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED,
        source: BookingSource.DROP_IN,
        amountPaidCents: 0,
        createdAt: new Date(b.createdAt),
        cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : null,
      })),
    });
  }

  console.log(`Loading ${memberships.length} memberships...`);
  for (const batch of chunk(memberships, CHUNK_SIZE)) {
    await prisma.membership.createMany({
      skipDuplicates: true,
      data: batch.map((m) => ({
        id: m.id,
        userId: m.userId,
        planId: m.planId,
        status:
          m.status === "PAUSED"
            ? MembershipStatus.PAUSED
            : m.status === "CANCELLED"
              ? MembershipStatus.CANCELLED
              : MembershipStatus.ACTIVE,
        currentPeriodStart: new Date(m.currentPeriodStart),
        currentPeriodEnd: new Date(m.currentPeriodEnd),
        creditsRemaining: m.creditsRemaining,
        pausedAt: m.pausedAt ? new Date(m.pausedAt) : null,
      })),
    });
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
