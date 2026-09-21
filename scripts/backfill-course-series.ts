// Groups imported course sessions into series.
//
// A course (Pottery Kickstart, the Lehi youth courses) is sold as one line that
// books every remaining session, and the POS finds a course's sessions through
// StudioSession.seriesId. Only the admin schedule's "repeat weekly" sets that
// id; the sessions imported from Momence have none, so the register would list
// each weekly night as its own one-session "course" at the full course price.
//
// This gives upcoming course sessions a seriesId. A cohort is the sessions of
// one COURSE class type at one studio that fall on the same weekday at the same
// Mountain Time start, one week apart (a skipped week is allowed). A session
// with no neighbours is left alone. Past sessions, cancelled sessions and
// sessions that already have a seriesId are never touched.
//
// Momence also exported one "container" row per course: a session that starts
// with the first class and ends weeks later. It is not a class anyone attends,
// so it is kept out of every series and listed for the owner to cancel in the
// schedule (it may carry the course's original Momence bookings, so this script
// does not cancel it).
//
// Run AFTER scripts/sync-class-types.ts (it creates the COURSE class types and
// moves the upcoming sessions onto them). Dry run by default; --apply to write.
// Safe to run twice: the second run finds nothing to do.
//
//   npm run catalog:backfill-series
//   npm run catalog:backfill-series -- --apply
import { PrismaClient } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const STUDIO_TIMEZONE = "America/Denver";
const DAY_MS = 24 * 60 * 60 * 1000;
// One week apart, or two when a week was skipped for a holiday.
const MAX_GAP_DAYS = 14.5;
// Longer than any real class: a Momence course container row.
const CONTAINER_HOURS = 12;

async function main() {
  const found = await prisma.studioSession.findMany({
    where: {
      seriesId: null,
      isCancelled: false,
      startsAt: { gte: new Date() },
      sessionType: { kind: "COURSE" },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      locationId: true,
      sessionTypeId: true,
      sessionType: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const isContainer = (s: (typeof found)[number]) =>
    (s.endsAt.getTime() - s.startsAt.getTime()) / (60 * 60 * 1000) > CONTAINER_HOURS;
  const containers = found.filter(isContainer);
  const sessions = found.filter((s) => !isContainer(s));

  // Same class, studio, weekday and start time.
  const slots = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = [
      s.sessionTypeId,
      s.locationId ?? "none",
      formatInTimeZone(s.startsAt, STUDIO_TIMEZONE, "i HH:mm"),
    ].join("|");
    slots.set(key, [...(slots.get(key) ?? []), s]);
  }

  const cohorts: (typeof sessions)[] = [];
  for (const slot of slots.values()) {
    let run: typeof sessions = [];
    for (const s of slot) {
      const prev = run[run.length - 1];
      if (prev && (s.startsAt.getTime() - prev.startsAt.getTime()) / DAY_MS > MAX_GAP_DAYS) {
        cohorts.push(run);
        run = [];
      }
      run.push(s);
    }
    cohorts.push(run);
  }

  const series = cohorts.filter((c) => c.length > 1);
  const alone = cohorts.filter((c) => c.length === 1).length;

  console.log(`Mode: ${APPLY ? "APPLY" : "dry run (pass --apply to write)"}\n`);
  for (const c of containers) {
    console.log(
      `CONTAINER  ${c.sessionType.name} · ${c.location?.name ?? "no studio"} · ` +
        `${formatInTimeZone(c.startsAt, STUDIO_TIMEZONE, "MMM d h:mm a")} to ${formatInTimeZone(c.endsAt, STUDIO_TIMEZONE, "MMM d")}` +
        ` — a Momence course row, not a class. Left alone; cancel it in the schedule.`,
    );
  }
  if (series.length === 0) {
    console.log("No changes — every upcoming course session is already in a series or stands alone.");
    return;
  }

  for (const cohort of series) {
    const [first] = cohort;
    const dates = cohort.map((s) => formatInTimeZone(s.startsAt, STUDIO_TIMEZONE, "MMM d")).join(", ");
    console.log(
      `SERIES  ${first.sessionType.name} · ${first.location?.name ?? "no studio"} · ` +
        `${formatInTimeZone(first.startsAt, STUDIO_TIMEZONE, "EEEE h:mm a")} · ${cohort.length} sessions (${dates})`,
    );
    if (APPLY) {
      await prisma.studioSession.updateMany({
        where: { id: { in: cohort.map((s) => s.id) }, seriesId: null },
        data: { seriesId: `series_${first.id}` },
      });
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Plan"}: ${series.length} series, ` +
      `${series.reduce((n, c) => n + c.length, 0)} sessions grouped, ${alone} single session${alone === 1 ? "" : "s"} left alone.`,
  );
  if (!APPLY) console.log("Dry run only — re-run with --apply to write these changes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
