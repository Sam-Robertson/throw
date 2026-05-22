import { formatInTimeZone } from "date-fns-tz";
import { inngest, type BookingEventData, type MembershipEventData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { interpolateTemplate, sendSms } from "@/lib/sms";

const STUDIO_TZ = "America/Denver";

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadBookingForSms(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      studioSession: {
        include: {
          sessionType: { select: { name: true } },
          location: { select: { name: true } },
        },
      },
      user: { select: { name: true, phone: true } },
    },
  });
}

async function handleBookingSms(
  triggerEvent: string,
  bookingId: string,
  userId: string,
): Promise<{ skipped?: true; reason?: string; sent?: true }> {
  const booking = await loadBookingForSms(bookingId);
  if (!booking) return { skipped: true, reason: "booking not found" };

  const automation = await prisma.smsAutomation.findFirst({
    where: { triggerEvent, isActive: true },
  });
  if (!automation) return { skipped: true, reason: "no active automation" };

  const phone = booking.user.phone;
  if (!phone) {
    await prisma.smsLog.create({
      data: {
        userId,
        toPhone: "",
        message: automation.messageTemplate,
        status: "skipped",
        automationId: automation.id,
      },
    });
    return { skipped: true, reason: "no phone" };
  }

  const vars: Record<string, string> = {
    name: booking.user.name?.split(" ")[0] ?? "",
    session_type: booking.studioSession.sessionType.name,
    date: formatInTimeZone(
      new Date(booking.studioSession.startsAt),
      STUDIO_TZ,
      "EEEE, MMMM d",
    ),
    time: formatInTimeZone(
      new Date(booking.studioSession.startsAt),
      STUDIO_TZ,
      "h:mm a",
    ),
    location: booking.studioSession.location?.name ?? "",
  };

  const message = interpolateTemplate(automation.messageTemplate, vars);
  await sendSms({ to: phone, message, userId, automationId: automation.id });
  return { sent: true };
}

// ── booking/confirmed ─────────────────────────────────────────────────────────

export const sendBookingConfirmation = inngest.createFunction(
  { id: "send-booking-confirmation", triggers: [{ event: "booking/confirmed" }] },
  async ({ event, step }) => {
    const { bookingId, userId } = event.data as BookingEventData;
    return step.run("send-sms", () =>
      handleBookingSms("booking/confirmed", bookingId, userId),
    );
  },
);

// ── booking/reminder ──────────────────────────────────────────────────────────

export const sendBookingReminder = inngest.createFunction(
  { id: "send-booking-reminder", triggers: [{ event: "booking/reminder" }] },
  async ({ event, step }) => {
    const { bookingId, userId } = event.data as BookingEventData;
    return step.run("send-sms", () =>
      handleBookingSms("booking/reminder", bookingId, userId),
    );
  },
);

// ── booking/cancelled ─────────────────────────────────────────────────────────

export const sendBookingCancellation = inngest.createFunction(
  { id: "send-booking-cancellation", triggers: [{ event: "booking/cancelled" }] },
  async ({ event, step }) => {
    const { bookingId, userId } = event.data as BookingEventData;
    return step.run("send-sms", () =>
      handleBookingSms("booking/cancelled", bookingId, userId),
    );
  },
);

// ── membership/created ────────────────────────────────────────────────────────

export const sendMembershipWelcome = inngest.createFunction(
  { id: "send-membership-welcome", triggers: [{ event: "membership/created" }] },
  async ({ event, step }) => {
    const { membershipId, userId } = event.data as MembershipEventData;

    return step.run("send-sms", async () => {
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        include: {
          plan: { select: { name: true } },
          user: { select: { name: true, phone: true } },
        },
      });
      if (!membership) return { skipped: true, reason: "membership not found" };

      const automation = await prisma.smsAutomation.findFirst({
        where: { triggerEvent: "membership/created", isActive: true },
      });
      if (!automation) return { skipped: true, reason: "no active automation" };

      const phone = membership.user.phone;
      if (!phone) {
        await prisma.smsLog.create({
          data: {
            userId,
            toPhone: "",
            message: automation.messageTemplate,
            status: "skipped",
            automationId: automation.id,
          },
        });
        return { skipped: true, reason: "no phone" };
      }

      const vars: Record<string, string> = {
        name: membership.user.name?.split(" ")[0] ?? "",
        plan_name: membership.plan.name,
      };
      const message = interpolateTemplate(automation.messageTemplate, vars);
      await sendSms({ to: phone, message, userId, automationId: automation.id });
      return { sent: true };
    });
  },
);

// ── membership/paused ─────────────────────────────────────────────────────────

export const sendMembershipPaused = inngest.createFunction(
  { id: "send-membership-paused", triggers: [{ event: "membership/paused" }] },
  async ({ event, step }) => {
    const { membershipId, userId } = event.data as MembershipEventData;

    return step.run("send-sms", async () => {
      const membership = await prisma.membership.findUnique({
        where: { id: membershipId },
        include: {
          user: { select: { name: true, phone: true } },
        },
      });
      if (!membership) return { skipped: true, reason: "membership not found" };

      const automation = await prisma.smsAutomation.findFirst({
        where: { triggerEvent: "membership/paused", isActive: true },
      });
      if (!automation) return { skipped: true, reason: "no active automation" };

      const phone = membership.user.phone;
      if (!phone) {
        await prisma.smsLog.create({
          data: {
            userId,
            toPhone: "",
            message: automation.messageTemplate,
            status: "skipped",
            automationId: automation.id,
          },
        });
        return { skipped: true, reason: "no phone" };
      }

      const vars: Record<string, string> = {
        name: membership.user.name?.split(" ")[0] ?? "",
      };
      const message = interpolateTemplate(automation.messageTemplate, vars);
      await sendSms({ to: phone, message, userId, automationId: automation.id });
      return { sent: true };
    });
  },
);

// ── schedule-booking-reminder ─────────────────────────────────────────────────

export const scheduleBookingReminder = inngest.createFunction(
  { id: "schedule-booking-reminder", triggers: [{ event: "booking/confirmed" }] },
  async ({ event, step }) => {
    const { bookingId, userId, studioSessionId } = event.data as BookingEventData;

    const startsAtIso = await step.run("load-session", async () => {
      const session = await prisma.studioSession.findUnique({
        where: { id: studioSessionId },
        select: { startsAt: true },
      });
      return session ? session.startsAt.toISOString() : null;
    });

    if (!startsAtIso) return { skipped: true, reason: "session not found" };

    const reminderTime = new Date(
      new Date(startsAtIso).getTime() - 24 * 60 * 60 * 1000,
    );

    if (reminderTime <= new Date()) {
      return { skipped: true, reason: "reminder time is in the past" };
    }

    await step.sleepUntil("wait-for-reminder-time", reminderTime);

    await step.sendEvent("send-reminder", {
      name: "booking/reminder",
      data: { bookingId, userId, studioSessionId },
    });

    return { scheduled: true, reminderTime: reminderTime.toISOString() };
  },
);
