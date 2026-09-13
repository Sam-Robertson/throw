import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { sendInngestEvent } from "@/lib/inngest";
import { sendSms } from "@/lib/sms";
import { maybeCompletePosOrder } from "@/lib/pos";
import { TERMINAL_METHOD, settleTerminalPayment } from "@/lib/terminal";
import { grantPeriodAllowance } from "@/lib/credits";
import { addMonths } from "date-fns";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

// App Router reads raw body via req.text() — no bodyParser config needed
export const config = { api: { bodyParser: false } };

/**
 * Records a paid subscription invoice (first charge, joining fee included, and
 * every renewal) as a MEMBERSHIP Payment so it shows up in revenue reports.
 * Idempotent on Payment.stripeInvoiceId.
 *
 * The first invoice can arrive before customer.subscription.created has
 * created the Membership, so userId/planId fall back to the subscription
 * metadata snapshot on the invoice (written by /api/memberships/subscribe).
 */
async function recordInvoicePayment(invoice: Stripe.Invoice, subscriptionId: string) {
  if (!invoice.id || invoice.amount_paid <= 0) return;

  const membership = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, userId: true, planId: true, locationId: true },
  });
  const subscriptionMetadata = invoice.parent?.subscription_details?.metadata ?? {};
  const userId = membership?.userId ?? subscriptionMetadata.userId;
  const planId = membership?.planId ?? subscriptionMetadata.planId;
  if (!userId) {
    console.warn(`[stripe webhook] invoice ${invoice.id}: no membership or userId metadata; payment not recorded`);
    return;
  }

  const plan = planId
    ? await prisma.membershipPlan.findUnique({ where: { id: planId }, select: { locationId: true } })
    : null;
  // Payment.locationId is required. Memberships created through checkout carry
  // no location and most plans have none, so fall back to the oldest active
  // studio rather than dropping the revenue row.
  const locationId =
    membership?.locationId ??
    plan?.locationId ??
    (
      await prisma.location.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;
  if (!locationId) {
    console.warn(`[stripe webhook] invoice ${invoice.id}: no location available; payment not recorded`);
    return;
  }

  const lines = invoice.lines.data.map((line) => ({
    description: line.description,
    amountCents: line.amount,
    isJoiningFee: /joining fee/i.test(line.description ?? ""),
  }));

  try {
    await prisma.payment.create({
      data: {
        userId,
        locationId,
        // The invoice's PaymentIntent is only reachable through the invoice
        // payments API (not in the webhook payload), so a deterministic
        // placeholder satisfies the required unique column, as POS does.
        stripePaymentIntentId: `inv_${invoice.id}`,
        stripeInvoiceId: invoice.id,
        amountInCents: invoice.amount_paid,
        status: "SUCCEEDED",
        type: "MEMBERSHIP",
        membershipId: membership?.id ?? null,
        metadata: {
          stripeSubscriptionId: subscriptionId,
          billingReason: invoice.billing_reason,
          lines,
          linesTruncated: invoice.lines.has_more,
        },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return; // already recorded — duplicate delivery
    }
    throw err;
  }
}

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
    const { userId, planId, joiningFeeCharged } = subscription.metadata ?? {};
    if (userId && planId) {
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      try {
        const item = subscription.items.data[0];
        const currentPeriodStart = new Date(item.current_period_start * 1000);
        const currentPeriodEnd = new Date(item.current_period_end * 1000);
        const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
        const membership = await prisma.membership.create({
          data: {
            userId,
            planId,
            status: "ACTIVE",
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            currentPeriodStart,
            currentPeriodEnd,
            creditsRemaining: 0,
            // The joining-fee decision is made once, at checkout time in the
            // subscribe route (based on whether the user had ever held a
            // membership before) — it's carried here via subscription
            // metadata rather than re-derived, so the two never disagree.
            joiningFeePaid: joiningFeeCharged === "true",
            commitmentEndsAt:
              plan?.commitmentMonths != null
                ? addMonths(currentPeriodStart, plan.commitmentMonths)
                : null,
          },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "CREATED" },
        });
        await grantPeriodAllowance(
          membership.id,
          membership.currentPeriodStart,
          membership.currentPeriodEnd,
        );
        await sendInngestEvent({
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
        const newPeriodStart = new Date(invoice.period_start * 1000);
        const newPeriodEnd = new Date(invoice.period_end * 1000);
        await prisma.membership.update({
          where: { id: membership.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
          },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "RENEWED" },
        });
        await grantPeriodAllowance(membership.id, newPeriodStart, newPeriodEnd);
      }
      await recordInvoicePayment(invoice, subscriptionId);
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
            kind: "transactional",
          }).catch(() => {
            // Non-fatal: SMS failure should not block the tip record
          });
        }
      }
    } else {
      // ── Drop-in booking payment ───────────────────────────────────
      const { userId, studioSessionId } = metadata;

      if (!userId || !studioSessionId) {
        // Not a booking checkout. The Lehi preorder widget
        // (/api/preorder/checkout) sends none of this metadata — its sales live
        // in Stripe only and are not persisted here. Acknowledge with 200
        // either way: a 4xx makes Stripe retry the event for days without
        // ever succeeding.
        if (metadata.source === "lehi-preorder-widget") {
          console.log(
            `[stripe webhook] Lehi preorder checkout ${checkoutSession.id} completed (not persisted)`,
          );
        } else {
          console.warn(
            `[stripe webhook] checkout ${checkoutSession.id} has no booking metadata; ignored`,
          );
        }
        return NextResponse.json({ received: true });
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
        await sendInngestEvent({
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
  } else if (event.type === "payment_intent.succeeded") {
    // ── POS card-manual payment (separate from the tip/drop-in Checkout flows
    //    above, which use checkout.session.completed instead) ───────────────
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.type === "pos") {
      const payment = await prisma.posPayment.findFirst({
        where: { stripePaymentIntentId: intent.id },
      });
      if (payment && payment.status !== "SUCCEEDED") {
        if (payment.method === TERMINAL_METHOD) {
          // Reader payments can carry an on-reader tip, so the captured amount
          // is larger than what we recorded when the PaymentIntent was created.
          // settleTerminalPayment reconciles the payment amount and the order's
          // tip before completing; settling it here the plain way would silently
          // drop the tip. Same PENDING guard, so this and the status endpoint
          // stay mutually idempotent.
          await settleTerminalPayment(payment.id, intent);
        } else {
          const { count } = await prisma.posPayment.updateMany({
            where: { id: payment.id, status: "PENDING" },
            data: { status: "SUCCEEDED" },
          });
          if (count > 0) {
            await maybeCompletePosOrder(payment.orderId);
          }
        }
      }
      // If no matching PosPayment or it's already SUCCEEDED, this is a no-op —
      // either a race already settled by the confirm endpoint, or a retry.
    }
    // Non-POS payment_intent.succeeded events (e.g. the PaymentIntent behind a
    // tip/drop-in Checkout Session) are handled via checkout.session.completed
    // above and intentionally ignored here.
  }

  return NextResponse.json({ received: true });
}
