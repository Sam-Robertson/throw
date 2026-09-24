import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { maybeCompletePosOrder, recalculateOrderTotals } from "@/lib/pos";

/**
 * Stripe Terminal (BBPOS WisePOS E) support for the POS.
 *
 * This is a *server-driven* integration: the reader is a smart reader on the
 * network, so the backend drives it with terminal.readers.processPaymentIntent
 * and the browser only polls for the result. There is no Terminal JS SDK and no
 * connection-token endpoint — those are only needed for SDK-driven readers like
 * the M2/chipper.
 *
 * Card readers belong to a Stripe Terminal Location (tml_...), which each studio
 * maps to via Location.stripeTerminalLocationId.
 */

export const TERMINAL_METHOD = "CARD_TERMINAL";

import {
  SMART_TIP_THRESHOLD_CENTS,
  TIP_FIXED_CENTS,
  TIP_PERCENTAGES,
} from "@/lib/tipping";

export { TIP_PERCENTAGES };

export class TerminalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * On-reader tipping is a Stripe Terminal *configuration*: the reader only shows
 * the tip screen when the account's default configuration has USD tipping set
 * up, whatever process_config we send with the payment. These two helpers let
 * Studio setup check and switch it on without visiting the Stripe Dashboard.
 */
export interface TippingSetup {
  enabled: boolean;
  configurationId: string | null;
  percentages: number[];
  fixedAmountsCents: number[];
  smartTipThresholdCents: number | null;
}

async function defaultTerminalConfiguration(): Promise<Stripe.Terminal.Configuration | null> {
  const configurations = await stripe.terminal.configurations.list({ is_account_default: true, limit: 1 });
  return configurations.data[0] ?? null;
}

export async function getTippingSetup(): Promise<TippingSetup> {
  const config = await defaultTerminalConfiguration();
  const usd = config?.tipping?.usd;
  return {
    enabled: Boolean(usd && ((usd.percentages?.length ?? 0) > 0 || (usd.fixed_amounts?.length ?? 0) > 0)),
    configurationId: config?.id ?? null,
    percentages: usd?.percentages ?? [],
    fixedAmountsCents: usd?.fixed_amounts ?? [],
    smartTipThresholdCents: usd?.smart_tip_threshold ?? null,
  };
}

/** Turns on the reader's tip screen with the studio's standard options (see src/lib/tipping.ts). */
export async function enableOnReaderTipping(): Promise<TippingSetup> {
  const tipping = {
    usd: {
      percentages: [...TIP_PERCENTAGES],
      fixed_amounts: [...TIP_FIXED_CENTS],
      smart_tip_threshold: SMART_TIP_THRESHOLD_CENTS,
    },
  };
  const existing = await defaultTerminalConfiguration();
  if (existing) await stripe.terminal.configurations.update(existing.id, { tipping });
  else await stripe.terminal.configurations.create({ tipping });
  return getTippingSetup();
}

/** Turns the reader's tip screen off. The POS screen prompt and manual tips still work. */
export async function disableOnReaderTipping(): Promise<TippingSetup> {
  const existing = await defaultTerminalConfiguration();
  if (existing) await stripe.terminal.configurations.update(existing.id, { tipping: "" });
  return getTippingSetup();
}

/** The Stripe Terminal Location a studio maps to, or a clear error if unlinked. */
export async function requireTerminalLocation(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, stripeTerminalLocationId: true },
  });
  if (!location) throw new TerminalError("Location not found", 404);
  if (!location.stripeTerminalLocationId) {
    throw new TerminalError(
      `${location.name} has no card reader location yet. Link it in Studio setup → Card readers.`,
      409,
    );
  }
  return location as typeof location & { stripeTerminalLocationId: string };
}

/**
 * Fetches a reader, narrowing away Stripe's DeletedReader union member.
 * Returns null for an unknown or unregistered reader so callers can treat
 * "gone" and "never existed" the same way.
 */
export async function retrieveReader(
  readerId: string,
): Promise<Stripe.Terminal.Reader | null> {
  const reader = await stripe.terminal.readers.retrieve(readerId).catch(() => null);
  if (!reader) return null;
  if ("deleted" in reader && reader.deleted) return null;
  return reader as Stripe.Terminal.Reader;
}

export type ReaderSummary = {
  id: string;
  label: string;
  deviceType: string;
  status: string;
  /** True while the reader is mid-action (someone else is using it). */
  busy: boolean;
};

function toSummary(r: Stripe.Terminal.Reader): ReaderSummary {
  return {
    id: r.id,
    label: r.label ?? r.id,
    deviceType: r.device_type,
    status: r.status ?? "unknown",
    busy: r.action?.status === "in_progress",
  };
}

/** Readers registered to a studio. Stripe is the registry — we never mirror it. */
export async function listReadersForLocation(locationId: string) {
  const location = await requireTerminalLocation(locationId);
  const readers = await stripe.terminal.readers.list({
    location: location.stripeTerminalLocationId,
    limit: 100,
  });
  return readers.data.map(toSummary);
}

/**
 * Settles a Terminal PosPayment from its PaymentIntent.
 *
 * On-reader tipping means the customer can add a tip *after* we created the
 * PaymentIntent, so the amount actually captured is larger than the amount we
 * recorded on the PosPayment. Both have to be reconciled or the tip is lost:
 *
 *   - PosPayment.amountCents must become the real captured amount, otherwise
 *     remainingBalanceCents() under-counts what was paid.
 *   - PosOrder.tipCents must absorb the tip, otherwise totalCents stays at the
 *     pre-tip figure, the order looks overpaid, and the tip never reaches
 *     reporting.
 *
 * Both are applied before maybeCompletePosOrder so completion sees final totals.
 * Guarded by an atomic PENDING -> SUCCEEDED updateMany, so whichever of the
 * status endpoint and the webhook lands first wins and the other is a no-op.
 */
export async function settleTerminalPayment(
  paymentId: string,
  intent: Stripe.PaymentIntent,
) {
  const payment = await prisma.posPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new TerminalError("Payment not found", 404);

  const capturedCents = intent.amount_received || intent.amount;
  const tipCents = intent.amount_details?.tip?.amount ?? 0;

  const { count } = await prisma.posPayment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "SUCCEEDED", amountCents: capturedCents },
  });

  // Lost the race — the other path already settled this payment and applied the
  // tip. Returning the current order avoids double-counting the tip.
  if (count === 0) {
    return prisma.posOrder.findUniqueOrThrow({
      where: { id: payment.orderId },
      include: { items: true, payments: true },
    });
  }

  if (tipCents > 0) {
    const order = await prisma.posOrder.findUniqueOrThrow({
      where: { id: payment.orderId },
      select: { tipCents: true },
    });
    await recalculateOrderTotals(payment.orderId, order.tipCents + tipCents);
  }

  return maybeCompletePosOrder(payment.orderId);
}

/** Marks a Terminal payment failed/cancelled. Safe to call more than once. */
export async function failTerminalPayment(paymentId: string) {
  await prisma.posPayment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}

export type TerminalProgress =
  | { state: "in_progress" }
  | { state: "succeeded"; order: unknown }
  | { state: "failed"; message: string };

/**
 * Where a Terminal payment has got to.
 *
 * Deliberately does NOT reuse the card-manual confirm endpoint: a Terminal
 * PaymentIntent legitimately sits at `requires_payment_method` for as long as it
 * takes the customer to tap, and that endpoint treats any non-succeeded status
 * as a failure. Only a terminal (pun intended) reader action state is a failure.
 */
export async function getTerminalProgress(
  paymentId: string,
  readerId: string,
  paymentIntentId: string,
): Promise<TerminalProgress> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  // Only `succeeded` counts. These intents are created with automatic capture,
  // so `requires_capture` should never appear — and if it somehow did, treating
  // it as settled would complete the order against funds never captured.
  if (intent.status === "succeeded") {
    const order = await settleTerminalPayment(paymentId, intent);
    return { state: "succeeded", order };
  }

  if (intent.status === "canceled") {
    await failTerminalPayment(paymentId);
    return { state: "failed", message: "Payment was cancelled." };
  }

  // The PaymentIntent is still open, so the reader is the source of truth for
  // whether the customer is mid-flow or the attempt already failed.
  const reader = await retrieveReader(readerId);
  const action = reader?.action;

  if (action?.status === "failed") {
    await failTerminalPayment(paymentId);
    return {
      state: "failed",
      message: action.failure_message ?? "The reader could not take that card.",
    };
  }

  return { state: "in_progress" };
}
