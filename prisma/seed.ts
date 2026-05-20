import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fromZonedTime } from "date-fns-tz";
import { startOfWeek, addDays } from "date-fns";

const prisma = new PrismaClient();
const TZ = "America/Denver";

function fromMT(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TZ);
}

function mondayOfCurrentWeek(): Date {
  // Compute this week's Monday in Mountain Time
  const nowMT = fromZonedTime(new Date().toISOString(), TZ);
  return startOfWeek(nowMT, { weekStartsOn: 1 });
}

function weekDate(dayOffset: number): string {
  const monday = mondayOfCurrentWeek();
  const d = addDays(monday, dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const password = await bcrypt.hash("changeme123", 12);

  // Users
  const admin = await prisma.user.upsert({
    where: { email: "admin@throw.studio" },
    update: {},
    create: {
      email: "admin@throw.studio",
      name: "Admin",
      hashedPassword: password,
      role: "ADMIN",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@throw.studio" },
    update: {},
    create: {
      email: "staff@throw.studio",
      name: "Staff",
      hashedPassword: password,
      role: "STAFF",
    },
  });

  // Session types
  const openStudio = await prisma.sessionType.upsert({
    where: { slug: "open-studio" },
    update: {},
    create: {
      name: "Open Studio",
      slug: "open-studio",
      durationMinutes: 180,
      capacity: 20,
      dropInPriceCents: 1500,
      isBusyWindow: false,
    },
  });

  const busyWindow = await prisma.sessionType.upsert({
    where: { slug: "busy-window-open-studio" },
    update: {},
    create: {
      name: "Busy Window — Open Studio",
      slug: "busy-window-open-studio",
      durationMinutes: 120,
      capacity: 20,
      dropInPriceCents: 2000,
      isBusyWindow: true,
    },
  });

  const wheelThrowing = await prisma.sessionType.upsert({
    where: { slug: "wheel-throwing-101" },
    update: {},
    create: {
      name: "Wheel Throwing 101",
      slug: "wheel-throwing-101",
      durationMinutes: 90,
      capacity: 8,
      dropInPriceCents: 4500,
      isBusyWindow: false,
    },
  });

  const handBuilding = await prisma.sessionType.upsert({
    where: { slug: "hand-building-workshop" },
    update: {},
    create: {
      name: "Hand Building Workshop",
      slug: "hand-building-workshop",
      durationMinutes: 90,
      capacity: 10,
      dropInPriceCents: 4000,
      isBusyWindow: false,
    },
  });

  // Studio sessions — spread across current week
  const sessionSeeds = [
    { type: openStudio, day: 0, time: "09:00", instructor: admin }, // Mon
    { type: wheelThrowing, day: 1, time: "18:00", instructor: staff }, // Tue
    { type: handBuilding, day: 2, time: "10:00", instructor: staff }, // Wed
    { type: busyWindow, day: 3, time: "19:00", instructor: null }, // Thu
    { type: openStudio, day: 5, time: "14:00", instructor: admin }, // Sat
  ];

  for (const seed of sessionSeeds) {
    const dateStr = weekDate(seed.day);
    const startsAt = fromMT(dateStr, seed.time);
    const endsAt = new Date(
      startsAt.getTime() + seed.type.durationMinutes * 60 * 1000,
    );

    const existing = await prisma.studioSession.findFirst({
      where: { sessionTypeId: seed.type.id, startsAt },
    });

    if (!existing) {
      await prisma.studioSession.create({
        data: {
          sessionTypeId: seed.type.id,
          instructorId: seed.instructor?.id ?? null,
          startsAt,
          endsAt,
          capacity: seed.type.capacity,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  admin@throw.studio  / changeme123 (ADMIN)`);
  console.log(`  staff@throw.studio  / changeme123 (STAFF)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
