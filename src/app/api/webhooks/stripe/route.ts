import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";
import { sendSms } from "@/lib/sms";
import type Stripe from "stripe";

// App Router reads raw body via req.text() — no bodyParser config needed
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const { userId, planId } = subscription.metadata ?? {};
    if (userId && planId) {
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      try {
        const item = subscription.items.data[0];
        const membership = await prisma.membership.create({
          data: {
            userId,
            planId,
            status: "ACTIVE",
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            currentPeriodStart: new Date(item.current_period_start * 1000),
            currentPeriodEnd: new Date(item.current_period_end * 1000),
            creditsRemaining: 0,
          },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "CREATED" },
        });
        await inngest.send({
          name: "membership/created",
          data: { membershipId: membership.id, userId },
        });

        // Fire purchase conversion for new membership
        prisma.adTracking
          .findFirst({ where: { userId } })
          .then((t) => {
            if (t && !t.firstPurchaseAt) {
              prisma.adTracking
                .update({ where: { id: t.id }, data: { firstPurchaseAt: new Date() } })
                .catch(() => {});
            }
          })
          .catch(() => {});
      } catch {
        // Idempotency: skip if membership already exists for this subscription
      }
    }
  } else if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const membership = await prisma.membership.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (membership) {
      const item = subscription.items.data[0];
      const periodStart = new Date(item.current_period_start * 1000);
      const periodEnd = new Date(item.current_period_end * 1000);

      if (subscription.status === "past_due") {
        // PAST_DUE is not in the MembershipStatus enum; PAUSED is the closest available
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "PAUSED", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        });
        await prisma.membershipEvent.create({
          data: {
            membershipId: membership.id,
            eventType: "CANCELLED",
            note: "Payment past due",
          },
        });
      } else if (subscription.status === "active" && membership.status === "PAUSED") {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "RESUMED" },
        });
      } else {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        });
      }
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const membership = await prisma.membership.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (membership) {
      if (membership.pausedAt != null) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "PAUSED" },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "PAUSED" },
        });
      } else {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "CANCELLED" },
        });
      }
    }
  } else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
    if (subscriptionId) {
      const membership = await prisma.membership.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (membership) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "PAUSED" },
        });
        await prisma.membershipEvent.create({
          data: {
            membershipId: membership.id,
            eventType: "CANCELLED",
            note: "Payment failed",
          },
        });
      }
    }
  } else if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
    if (subscriptionId) {
      const membership = await prisma.membership.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (membership) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: {
            currentPeriodStart: new Date(invoice.period_start * 1000),
            currentPeriodEnd: new Date(invoice.period_end * 1000),
          },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "RENEWED" },
        });
      }
    }
  } else if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const metadata = checkoutSession.metadata ?? {};

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : (checkoutSession.payment_intent?.id ?? null);

    if (metadata.type === "tip") {
      // ── Tip payment ──────────────────────────────────────────────
      const { bookingId, userId, instructorId, locationId } = metadata;

      if (!bookingId || !userId || !instructorId || !locationId || !paymentIntentId) {
        return NextResponse.json({ error: "Missing tip metadata" }, { status: 400 });
      }

      const amountInCents = checkoutSession.amount_total ?? 0;

      // Idempotency: skip if tip already created (e.g., duplicate webhook)
      const existingTip = await prisma.tip.findFirst({ where: { bookingId } });
      if (!existingTip) {
        await prisma.tip.create({
          data: {
            bookingId,
            customerId: userId,
            instructorId,
            locationId,
            amountInCents,
            stripePaymentIntentId: paymentIntentId,
          },
        });

        await prisma.payment
          .create({
            data: {
              userId,
              locationId,
              stripePaymentIntentId: paymentIntentId,
              amountInCents,
              status: "SUCCEEDED",
              type: "TIP",
              bookingId,
            },
          })
          .catch(() => {
            // Idempotency: ignore if payment record already exists
          });

        // Notify instructor via SMS if they have a phone number
        const instructor = await prisma.user.findUnique({
          where: { id: instructorId },
          select: { phone: true, name: true },
        });
        if (instructor?.phone) {
          const dollars = (amountInCents / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          });
          await sendSms({
            to: instructor.phone,
            message: `You received a ${dollars} tip! Thank you for teaching a great class.`,
            userId: instructorId,
          }).catch(() => {
            // Non-fatal: SMS failure should not block the tip record
          });
        }
      }
    } else {
      // ── Drop-in booking payment ───────────────────────────────────
      const { userId, studioSessionId } = metadata;

      if (!userId || !studioSessionId) {
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const studioSession = await prisma.studioSession.findUnique({
        where: { id: studioSessionId },
        include: {
          _count: { select: { bookings: { where: { status: "CONFIRMED" } } } },
        },
      });

      if (!studioSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 },
        );
      }

      const confirmedCount = studioSession._count.bookings;
      const bookingStatus =
        confirmedCount >= studioSession.capacity ? "WAITLIST" : "CONFIRMED";

      const amountPaid = checkoutSession.amount_total ?? 0;

      const booking = await prisma.booking.create({
        data: {
          userId,
          studioSessionId,
          status: bookingStatus,
          source: "DROP_IN",
          stripePaymentIntentId: paymentIntentId,
          amountPaidCents: amountPaid,
        },
      });

      if (studioSession.locationId && paymentIntentId) {
        await prisma.payment
          .create({
            data: {
              userId,
              locationId: studioSession.locationId,
              stripePaymentIntentId: paymentIntentId,
              amountInCents: amountPaid,
              status: "SUCCEEDED",
              type: "DROP_IN",
              bookingId: booking.id,
            },
          })
          .catch(() => {
            // Idempotency: ignore if payment record already exists
          });
      }

      if (bookingStatus === "CONFIRMED") {
        await inngest.send({
          name: "booking/confirmed",
          data: { bookingId: booking.id, userId, studioSessionId },
        });
      }

      // Fire booking + purchase conversions for DROP_IN
      prisma.adTracking
        .findFirst({ where: { userId } })
        .then((t) => {
          if (!t) return;
          const data: { firstBookingAt?: Date; firstPurchaseAt?: Date } = {};
          if (!t.firstBookingAt) data.firstBookingAt = new Date();
          if (!t.firstPurchaseAt) data.firstPurchaseAt = new Date();
          if (Object.keys(data).length) {
            prisma.adTracking.update({ where: { id: t.id }, data }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({ received: true });
}
