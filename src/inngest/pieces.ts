import { inngest, type BookingEventData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";

/**
 * Minutes after a session ends before the customer is prompted to log their
 * pieces. 0 for now; move it here when the prompt timing is decided.
 */
export const PIECE_PROMPT_DELAY_MINUTES = 0;

// ── booking/confirmed → piece/intake.prompt at session end ───────────────────

export const schedulePieceIntakePrompt = inngest.createFunction(
  { id: "schedule-piece-intake-prompt", triggers: [{ event: "booking/confirmed" }] },
  async ({ event, step }) => {
    const { bookingId } = event.data as BookingEventData;

    const endsAtIso = await step.run("load-session-end", async () => {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { studioSession: { select: { endsAt: true } } },
      });
      return booking ? booking.studioSession.endsAt.toISOString() : null;
    });
    if (!endsAtIso) return { skipped: true, reason: "booking not found" };

    const promptAt = new Date(
      new Date(endsAtIso).getTime() + PIECE_PROMPT_DELAY_MINUTES * 60 * 1000,
    );
    // Bookings confirmed after the session ended (e.g. POS walk-ins) prompt
    // straight away.
    if (promptAt > new Date()) {
      await step.sleepUntil("wait-for-session-end", promptAt);
    }

    const eligible = await step.run("recheck-booking", async () => {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, studioSession: { select: { isCancelled: true } } },
      });
      return !!booking && booking.status === "CONFIRMED" && !booking.studioSession.isCancelled;
    });
    if (!eligible) return { skipped: true, reason: "booking no longer confirmed" };

    await step.sendEvent("send-piece-intake-prompt", {
      name: "piece/intake.prompt",
      data: { bookingId },
    });

    return { prompted: true, promptAt: promptAt.toISOString() };
  },
);

// ── piece/intake.prompt (stub) ───────────────────────────────────────────────
// Placeholder consumer: the actual customer message (SMS/email with a link to
// /pieces/new?session=…) is later work. Logging only for now.

export const logPieceIntakePrompt = inngest.createFunction(
  { id: "log-piece-intake-prompt", triggers: [{ event: "piece/intake.prompt" }] },
  async ({ event }) => {
    const { bookingId } = event.data as { bookingId: string };
    console.log("[pieces] intake prompt due for booking", bookingId);
    return { logged: true, bookingId };
  },
);
