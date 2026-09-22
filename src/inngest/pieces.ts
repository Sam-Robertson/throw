import { inngest, type BookingEventData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { isSuppressed, normalizeEmail, normalizePhone } from "@/lib/consent";
import { resend } from "@/lib/resend";
import { sendSms } from "@/lib/sms";
import { realEmail } from "@/lib/walkinEmail";

/**
 * Minutes after a session ends before the customer is prompted to log their
 * pieces. 0 for now; move it here when the prompt timing is decided.
 */
export const PIECE_PROMPT_DELAY_MINUTES = 0;

const DEFAULT_FROM = "Throw Art Studio <hello@throwartstudio.com>";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

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

// ── piece/intake.prompt → "log the pieces you made" text or email ────────────
//
// Transactional (it's about the class they just took), like the booking
// reminders: marketing opt-in doesn't apply, the suppression list does. Texts
// when there is a phone number, else emails a real (non-placeholder) address.
// Skipped when the customer already logged a Piece for that session, so the
// front desk logging it for them also stops the nudge.

export type IntakePromptResult = {
  sent?: "sms" | "email";
  skipped?: true;
  reason?: string;
};

export async function sendPieceIntakePrompt(bookingId: string): Promise<IntakePromptResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      userId: true,
      studioSessionId: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      studioSession: { select: { isCancelled: true, sessionType: { select: { name: true } } } },
    },
  });
  if (!booking) return { skipped: true, reason: "booking not found" };
  if (booking.status !== "CONFIRMED" || booking.studioSession.isCancelled) {
    return { skipped: true, reason: "booking no longer confirmed" };
  }

  const existing = await prisma.piece.findFirst({
    where: { userId: booking.userId, studioSessionId: booking.studioSessionId },
    select: { id: true },
  });
  if (existing) return { skipped: true, reason: "pieces already logged" };

  const link = `${appUrl()}/pieces/new?session=${encodeURIComponent(booking.studioSessionId)}`;
  const firstName = booking.user.name?.trim().split(/\s+/)[0];
  const body = `Thanks for throwing with us! Log the pieces you made so we can text you when they're ready: ${link}`;

  const phone = booking.user.phone && booking.user.phone.replace(/\D/g, "").length >= 10
    ? normalizePhone(booking.user.phone)
    : null;
  if (phone) {
    if (await isSuppressed("SMS", phone)) return { skipped: true, reason: "phone suppressed" };
    const result = await sendSms({
      to: phone,
      message: `${firstName ? `Hi ${firstName}! ` : ""}${body}`,
      userId: booking.user.id,
      kind: "transactional",
    });
    return result.ok ? { sent: "sms" } : { skipped: true, reason: result.error ?? "sms failed" };
  }

  const email = realEmail(booking.user.email);
  if (!email) return { skipped: true, reason: "no phone or real email" };
  if (await isSuppressed("EMAIL", normalizeEmail(email))) return { skipped: true, reason: "email suppressed" };
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: email,
      subject: `Log the pieces you made in ${booking.studioSession.sessionType.name}`,
      text: [firstName ? `Hi ${firstName},` : "Hi,", "", body, "", "Throw Art Studio"].join("\n"),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Failed to email piece intake prompt:", err);
    return { skipped: true, reason: "email failed" };
  }
  return { sent: "email" };
}

export const logPieceIntakePrompt = inngest.createFunction(
  { id: "log-piece-intake-prompt", triggers: [{ event: "piece/intake.prompt" }] },
  async ({ event, step }) => {
    const { bookingId } = event.data as { bookingId: string };
    return step.run("send-intake-prompt", () => sendPieceIntakePrompt(bookingId));
  },
);
