import { formatInTimeZone } from "date-fns-tz";
import { inngest, type BookingEventData, type MembershipEventData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { interpolateTemplate, sendSms } from "@/lib/sms";
import { resend } from "@/lib/resend";
import { formatMoney } from "@/lib/pos";

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
  await sendSms({ to: phone, message, userId, automationId: automation.id, kind: "transactional" });
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
      await sendSms({ to: phone, message, userId, automationId: automation.id, kind: "transactional" });
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
      await sendSms({ to: phone, message, userId, automationId: automation.id, kind: "transactional" });
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

// ── pos/order.completed ──────────────────────────────────────────────────────

export const sendPosReceipt = inngest.createFunction(
  { id: "send-pos-receipt", triggers: [{ event: "pos/order.completed" }] },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string };

    return step.run("send-receipt", async () => {
      const order = await prisma.posOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { createdAt: "asc" } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          location: { select: { name: true, address: true } },
        },
      });
      if (!order) return { skipped: true, reason: "order not found" };
      if (!order.customer) return { skipped: true, reason: "no customer on order" };
      if (!order.customer.email && !order.customer.phone) {
        return { skipped: true, reason: "customer has neither email nor phone" };
      }

      const dateStr = formatInTimeZone(
        order.completedAt ?? order.createdAt,
        STUDIO_TZ,
        "MMMM d, yyyy h:mm a",
      );
      const paymentMethods = [...new Set(order.payments.map((p) => p.method))].join(", ");

      // Receipts are transactional (the customer just completed a purchase),
      // so no marketing consent check applies. Prefer email; SMS is the
      // fallback only when there is no email on file.
      if (order.customer.email) {
        const lines = order.items
          .map((i) => `  ${i.quantity}x ${i.name} — ${formatMoney(i.totalCents)}`)
          .join("\n");
        const body = [
          `Throw Art Studio — Receipt #${order.orderNumber}`,
          order.location.name,
          order.location.address ?? "",
          dateStr,
          "",
          lines,
          "",
          `Subtotal: ${formatMoney(order.subtotalCents)}`,
          order.discountCents > 0 ? `Discount: -${formatMoney(order.discountCents)}` : null,
          order.tipCents > 0 ? `Tip: ${formatMoney(order.tipCents)}` : null,
          `Total: ${formatMoney(order.totalCents)}`,
          "",
          `Paid via: ${paymentMethods || "—"}`,
          "",
          "Thank you!",
        ]
          .filter((line): line is string => line !== null)
          .join("\n");

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "noreply@throw.studio",
          to: order.customer.email,
          subject: `Your receipt from ${order.location.name} — #${order.orderNumber}`,
          text: body,
        });
        return { sent: "email" };
      }

      await sendSms({
        to: order.customer.phone!,
        message: `Throw Art Studio receipt #${order.orderNumber}. Total ${formatMoney(order.totalCents)}. Thanks!`,
        userId: order.customer.id,
        kind: "transactional",
      });
      return { sent: "sms" };
    });
  },
);
