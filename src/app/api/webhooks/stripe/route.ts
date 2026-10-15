import { type NextRequest, NextResponse } from "next/server";
import { configuredStripeAccounts, type StripeAccount } from "@/lib/stripe";
import { defaultStudioLocationId } from "@/lib/locations";
import { recordShopPurchase } from "@/lib/shop";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { sendInngestEvent } from "@/lib/inngest";
import { sendSms } from "@/lib/sms";
import { maybeCompletePosOrder } from "@/lib/pos";
import { parseTenderMetadata, recordBookingTenders } from "@/lib/bookingCheckout";
import { TERMINAL_METHOD, settleTerminalPayment } from "@/lib/terminal";
import { grantPeriodAllowance } from "@/lib/credits";
import { createMembershipFromSubscription } from "@/lib/membershipCreate";
import { freezeTermsFor } from "@/lib/membershipFreeze";
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
/**
 * Provo and Lehi are separate Stripe accounts, and each one has its own
 * endpoint registered for this URL with its own signing secret. The signature
 * only verifies with the secret of the account that sent the event, so trying
 * each configured secret both authenticates the delivery and says which
 * account it came from. Nothing below calls Stripe back, so the account is
 * only used for logging; ids in the payload (subscriptions, invoices,
 * PaymentIntents) are unique across accounts and look up the same rows.
 */
function verifyWebhook(
  body: string,
  signature: string,
): { event: Stripe.Event; account: StripeAccount } | null {
  for (const account of configuredStripeAccounts()) {
    if (!account.webhookSecret) continue;
    try {
      const event = account.client.webhooks.constructEvent(body, signature, account.webhookSecret);
      return { event, account };
    } catch {
      // Not this account's secret (or a tampered body): try the next.
    }
  }
  return null;
}

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
  // Payment.locationId is required. Fall back to the default studio (Provo)
  // rather than dropping the revenue row.
  const locationId =
    membership?.locationId ?? plan?.locationId ?? (await defaultStudioLocationId());
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

/**
 * A paused membership bills on the freeze price (src/lib/membershipFreeze.ts).
 * The freeze phase stamps `throwFreeze=true` on the subscription, and the
 * invoice carries a snapshot of that metadata; the pause dates on the
 * membership are the fallback for an invoice whose snapshot predates the
 * phase change.
 */
function isFreezeInvoice(
  invoice: Stripe.Invoice,
  membership: { pausedAt: Date | null; resumesAt: Date | null },
): boolean {
  if (invoice.parent?.subscription_details?.metadata?.throwFreeze === "true") return true;
  if (!membership.pausedAt) return false;
  const hour = 60 * 60 * 1000;
  const start = invoice.period_start * 1000;
  const afterPause = start >= membership.pausedAt.getTime() - hour;
  const beforeResume = !membership.resumesAt || start < membership.resumesAt.getTime() - hour;
  return afterPause && beforeResume;
}

/**
 * A paid freeze invoice: the membership is paused for this period and the
 * member earns the month's store credit (the amount promised when they
 * paused, not whatever the policy says now). Idempotent on the invoice id.
 */
async function applyFreezeInvoice(
  invoice: Stripe.Invoice,
  membership: { id: string; userId: string; locationId: string | null; planId: string },
  periodStart: Date,
  periodEnd: Date,
) {
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "PAUSED", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
  });

  const already = await prisma.membershipEvent.findFirst({
    where: {
      membershipId: membership.id,
      eventType: "CREDIT_ISSUED",
      metadata: { path: ["invoiceId"], equals: invoice.id },
    },
    select: { id: true },
  });
  if (already) return;

  const pauseEvent = await prisma.membershipEvent.findFirst({
    where: { membershipId: membership.id, eventType: "PAUSED" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  const promised = (pauseEvent?.metadata as { creditCentsPerFrozenMonth?: unknown } | null)
    ?.creditCentsPerFrozenMonth;
  const cents =
    typeof promised === "number"
      ? promised
      : (
          await freezeTermsFor({
            locationId: membership.locationId,
            plan: await prisma.membershipPlan.findUniqueOrThrow({
              where: { id: membership.planId },
              select: { locationId: true },
            }),
          })
        ).creditCentsPerFrozenMonth;
  if (cents <= 0) return;

  await prisma.user.update({
    where: { id: membership.userId },
    data: { accountCreditCents: { increment: cents } },
  });
  await prisma.membershipEvent.create({
    data: {
      membershipId: membership.id,
      eventType: "CREDIT_ISSUED",
      note: "Store credit for a paused month",
      metadata: { source: "freeze", cents, invoiceId: invoice.id },
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const verified = verifyWebhook(body, sig);
  if (!verified) {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }
  const { event, account } = verified;

  if (event.type === "customer.subscription.created") {
    // Online sign-ups and desk sales alike: see src/lib/membershipCreate.ts.
    // A membership the register already created for this subscription is
    // found and left alone.
    try {
      await createMembershipFromSubscription(event.data.object as Stripe.Subscription);
    } catch (err) {
      console.error("[stripe webhook] customer.subscription.created failed:", err);
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

      // A cancellation scheduled from the Stripe dashboard (or withdrawn there)
      // shows on the membership too.
      const cancelAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null;

      if (subscription.status === "past_due") {
        // PAST_DUE is not in the MembershipStatus enum; PAUSED is the closest available
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "PAUSED", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAt },
        });
        await prisma.membershipEvent.create({
          data: {
            membershipId: membership.id,
            eventType: "CANCELLED",
            note: "Payment past due",
          },
        });
      } else if (
        subscription.status === "active" &&
        membership.status === "PAUSED" &&
        membership.pausedAt === null
      ) {
        // Recovered from past due. A real pause (pausedAt set) is ended by the
        // first plan invoice after the freeze months, in invoice.payment_succeeded.
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAt },
        });
        await prisma.membershipEvent.create({
          data: { membershipId: membership.id, eventType: "RESUMED" },
        });
      } else {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAt },
        });
      }
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const membership = await prisma.membership.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    // The subscription has ended: a scheduled cancellation reaching its date,
    // an admin ending it, or Stripe giving up on payment. Paused memberships
    // keep their subscription (on the freeze price), so this is always the end.
    if (membership && membership.status !== "CANCELLED") {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelAt: null },
      });
      await prisma.membershipEvent.create({
        data: {
          membershipId: membership.id,
          eventType: "CANCELLED",
          note: membership.cancelAt ? "Membership ended as requested" : "Subscription ended",
        },
      });
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
      // Only a period's own invoice moves the period along. A proration
      // invoice (restarting a paused membership mid-month, a plan switch)
      // has billing_reason subscription_update and is just recorded as revenue.
      const periodInvoice =
        invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_create";
      if (membership && periodInvoice) {
        const newPeriodStart = new Date(invoice.period_start * 1000);
        const newPeriodEnd = new Date(invoice.period_end * 1000);
        if (isFreezeInvoice(invoice, membership)) {
          await applyFreezeInvoice(invoice, membership, newPeriodStart, newPeriodEnd);
        } else {
          const wasPaused = membership.status === "PAUSED" && membership.pausedAt !== null;
          await prisma.membership.update({
            where: { id: membership.id },
            data: {
              currentPeriodStart: newPeriodStart,
              currentPeriodEnd: newPeriodEnd,
              ...(wasPaused ? { status: "ACTIVE", pausedAt: null, resumesAt: null } : {}),
            },
          });
          if (wasPaused) {
            await prisma.membershipEvent.create({
              data: {
                membershipId: membership.id,
                eventType: "RESUMED",
                note: "Billing resumed after the paused months",
              },
            });
          }
          await prisma.membershipEvent.create({
            data: { membershipId: membership.id, eventType: "RENEWED" },
          });
          await grantPeriodAllowance(membership.id, newPeriodStart, newPeriodEnd);
        }
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

    if (metadata.type === "clay" || metadata.type === "firing") {
      // ── Member portal purchase (clay bag, glaze firing) ─────────────
      await recordShopPurchase(checkoutSession);
      return NextResponse.json({ received: true });
    }

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
            `[stripe webhook] Lehi preorder checkout ${checkoutSession.id} completed in the ${account.label} account (not persisted)`,
          );
        } else {
          console.warn(
            `[stripe webhook] checkout ${checkoutSession.id} (${account.label} account) has no booking metadata; ignored`,
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

      // Stripe retries webhooks. A second delivery must not book twice or
      // charge the gift card twice.
      if (paymentIntentId) {
        const alreadyBooked = await prisma.booking.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
          select: { id: true },
        });
        if (alreadyBooked) return NextResponse.json({ received: true });
      }

      const confirmedCount = studioSession._count.bookings;
      const bookingStatus =
        confirmedCount >= studioSession.capacity ? "WAITLIST" : "CONFIRMED";

      const amountPaid = checkoutSession.amount_total ?? 0;
      // Promo code and gift card chosen at checkout (src/lib/bookingCheckout.ts).
      const tenders = parseTenderMetadata(metadata);

      const booking = await prisma.booking.create({
        data: {
          userId,
          studioSessionId,
          status: bookingStatus,
          source: "DROP_IN",
          stripePaymentIntentId: paymentIntentId,
          amountPaidCents: amountPaid + tenders.giftCardCents,
        },
      });

      // The card payment succeeded, so now (and only now) the promo code is
      // redeemed and the gift card is charged.
      const tenderResult = await recordBookingTenders({ bookingId: booking.id, userId, ...tenders });

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
              ...(tenders.giftCardId || tenders.discountCodeId
                ? { metadata: { ...tenders, ...tenderResult } }
                : {}),
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
