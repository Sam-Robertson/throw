import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { isSuppressed, normalizeEmail, normalizePhone } from "@/lib/consent";
import { formatGiftCardCode } from "@/lib/giftCardCode";
import { formatMoney, metadataObject } from "@/lib/pos";
import { resend } from "@/lib/resend";
import { sendSms } from "@/lib/sms";
import { realEmail } from "@/lib/walkinEmail";

/**
 * POS receipts: what goes on one, and sending it by email or text.
 *
 * Two callers share this. The register's success screen sends the channel
 * staff picked through POST /api/pos/orders/[id]/receipt; the
 * `pos/order.completed` Inngest function is the safety net that emails the
 * customer on file a few minutes later if nobody picked anything.
 *
 * Receipts are transactional (the customer just paid), so marketing consent
 * doesn't apply, but the suppression list does: a STOP reply or a bounced
 * address is never messaged again. Placeholder `@walkin.invalid` addresses
 * (phone-only customers) are never emailed.
 */

const STUDIO_TZ = "America/Denver";
const DEFAULT_FROM = "noreply@throw.studio";

/** The register told us how this order's receipt should go out; cancels the automatic send. */
export const RECEIPT_CHOSEN_EVENT = "pos/receipt.chosen";

const PAYMENT_LABELS: Record<string, string> = {
  CARD_TERMINAL: "Card",
  CARD_MANUAL: "Card",
  GIFT_CARD: "Gift card",
  ACCOUNT_CREDIT: "Account credit",
  COMP: "Comp",
  CASH: "Cash",
};

export async function loadReceiptOrder(orderId: string) {
  return prisma.posOrder.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "asc" } },
      discounts: { orderBy: { createdAt: "asc" } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      location: { select: { name: true, address: true } },
    },
  });
}

export type ReceiptOrder = NonNullable<Awaited<ReturnType<typeof loadReceiptOrder>>>;

function giftCardCodesOf(metadata: ReceiptOrder["items"][number]["metadata"]): string[] {
  const raw = metadataObject(metadata).giftCardCodes;
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string").map(formatGiftCardCode) : [];
}

/** Each named discount with its amount, then whatever was taken off lines by hand. */
function discountLines(order: ReceiptOrder): string[] {
  const named = order.discounts.filter((d) => d.amountCents > 0);
  const namedCents = named.reduce((sum, d) => sum + d.amountCents, 0);
  const otherCents = Math.max(0, order.discountCents - namedCents);
  return [
    ...named.map((d) => `${d.name}: -${formatMoney(d.amountCents)}`),
    ...(otherCents > 0 ? [`${named.length > 0 ? "Other discounts" : "Discount"}: -${formatMoney(otherCents)}`] : []),
  ];
}

/** The plain-text receipt: lines with their notes, named discounts, tax, tip, total and tenders. */
export function buildReceiptText(order: ReceiptOrder): string {
  const dateStr = formatInTimeZone(order.completedAt ?? order.createdAt, STUDIO_TZ, "MMMM d, yyyy h:mm a");

  const lines = order.items.flatMap((i) => {
    // Shown at the list price; discounts are itemised by name underneath.
    const out = [`  ${i.quantity}x ${i.name} — ${formatMoney(i.unitPriceCents * i.quantity)}`];
    if (i.note) out.push(`    Note: ${i.note}`);
    const codes = giftCardCodesOf(i.metadata);
    if (codes.length > 0) out.push(`    Gift card code${codes.length > 1 ? "s" : ""}: ${codes.join(", ")}`);
    return out;
  });

  const payments = order.payments.map(
    (p) => `  ${PAYMENT_LABELS[p.method] ?? p.method}: ${formatMoney(p.amountCents)}`,
  );

  return [
    `Throw Art Studio — Receipt #${order.orderNumber}`,
    order.location.name,
    order.location.address ?? null,
    dateStr,
    "",
    ...lines,
    "",
    `Subtotal: ${formatMoney(order.subtotalCents)}`,
    ...discountLines(order),
    `Tax: ${formatMoney(order.taxCents)}`,
    order.tipCents > 0 ? `Tip: ${formatMoney(order.tipCents)}` : null,
    `Total: ${formatMoney(order.totalCents)}`,
    "",
    payments.length > 0 ? "Paid with:" : null,
    ...payments,
    "",
    "Thank you!",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** A text message has room for the totals, not every line. */
export function buildReceiptSms(order: ReceiptOrder): string {
  const codes = order.items.flatMap((i) => giftCardCodesOf(i.metadata));
  const discounts = order.discounts.filter((d) => d.amountCents > 0);
  const parts = [
    `Throw Art Studio receipt #${order.orderNumber}.`,
    `${order.items.reduce((n, i) => n + i.quantity, 0)} item(s), subtotal ${formatMoney(order.subtotalCents)}.`,
    ...discounts.map((d) => `${d.name} -${formatMoney(d.amountCents)}.`),
    `Tax ${formatMoney(order.taxCents)}.`,
    order.tipCents > 0 ? `Tip ${formatMoney(order.tipCents)}.` : null,
    `Total ${formatMoney(order.totalCents)}.`,
    codes.length > 0 ? `Gift card code${codes.length > 1 ? "s" : ""}: ${codes.join(", ")}.` : null,
    "Thanks!",
  ];
  return parts.filter((p): p is string => p !== null).join(" ");
}

export type ReceiptChannel = "email" | "sms" | "none";

export type ReceiptResult =
  | { ok: true; sent: ReceiptChannel; to: string | null }
  | { ok: false; status: number; error: string; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends one receipt. `to` overrides the contact on file (a walk-in typing an
 * email, or a customer who wants it somewhere else).
 */
export async function sendReceipt(
  order: ReceiptOrder,
  channel: ReceiptChannel,
  to?: string | null,
): Promise<ReceiptResult> {
  if (channel === "none") return { ok: true, sent: "none", to: null };

  if (channel === "email") {
    const address = to?.trim() ? normalizeEmail(to) : realEmail(order.customer?.email);
    if (!address || !EMAIL_PATTERN.test(address) || !realEmail(address)) {
      return { ok: false, status: 400, error: "NO_EMAIL", message: "Enter an email address to send the receipt to." };
    }
    if (await isSuppressed("EMAIL", normalizeEmail(address))) {
      return {
        ok: false,
        status: 409,
        error: "SUPPRESSED",
        message: "That email address has bounced or unsubscribed, so we can't email it. Try a text instead.",
      };
    }
    try {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
        to: address,
        subject: `Your receipt from ${order.location.name} — #${order.orderNumber}`,
        text: buildReceiptText(order),
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error("Failed to email POS receipt:", err);
      return { ok: false, status: 502, error: "SEND_FAILED", message: "The receipt email could not be sent." };
    }
    return { ok: true, sent: "email", to: address };
  }

  const rawPhone = to?.trim() || order.customer?.phone || order.walkInPhone;
  const digits = rawPhone?.replace(/\D/g, "") ?? "";
  if (!rawPhone || digits.length < 10 || digits.length > 15) {
    return { ok: false, status: 400, error: "NO_PHONE", message: "Enter a mobile number to text the receipt to." };
  }
  const phone = normalizePhone(rawPhone);
  if (await isSuppressed("SMS", phone)) {
    return {
      ok: false,
      status: 409,
      error: "SUPPRESSED",
      message: "That number has opted out of texts, so we can't text it. Try email instead.",
    };
  }
  const result = await sendSms({
    to: phone,
    message: buildReceiptSms(order),
    // SmsLog wants an owner; a walk-in has no account, so the order stands in.
    userId: order.customer?.id ?? `pos-order:${order.id}`,
    kind: "transactional",
  });
  if (!result.ok) {
    return { ok: false, status: 502, error: "SEND_FAILED", message: "The receipt text could not be sent." };
  }
  return { ok: true, sent: "sms", to: phone };
}
