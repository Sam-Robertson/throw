import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORY_LABELS, isProductCategory } from "@/config/taxCodes";
import { formatMountainTime } from "@/lib/timezone";
import { metadataObject, dropInSessionId } from "@/lib/pos";
import { membershipLineMetadata } from "@/lib/posMembership";

/**
 * Total sales: one row per thing sold, in the studio or online, so the
 * report can be filtered and totalled by category, payment date, service
 * date, studio, payment method and status, and downloaded as a CSV
 * (JP's ask, 2026-10-14; modelled on Momence's Total Sales report).
 *
 * Sources
 *   - POS orders (COMPLETED or VOIDED, by completedAt): one row per line plus
 *     one row per tip. Sale value is the line net of discounts; tax is the
 *     line's tax. A voided order's rows carry the refunded amount.
 *   - Online payments (the Payment table, excluding the POS mirrors): drop-in
 *     and course bookings, membership invoices, gift cards, tips, and member
 *     portal clay and firing purchases.
 *
 * Query: from, to (yyyy-mm-dd, Mountain Time days), locationId, and
 * format=csv for the download. Filtering by category, method and status is
 * done in the browser, which has every row for the range (capped).
 */

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

export interface SalesRow {
  id: string;
  category: string;
  item: string;
  /** When the money was taken. */
  paymentDate: string;
  /** When the class is (drop-ins, courses); null otherwise. */
  serviceDate: string | null;
  saleCents: number;
  taxCents: number;
  discountCents: number;
  refundedCents: number;
  paymentMethod: string;
  paymentStatus: "Paid" | "Voided" | "Refunded";
  /** Order number for register sales, Stripe id otherwise. */
  reference: string;
  paymentId: string | null;
  soldBy: string;
  customerName: string | null;
  customerEmail: string | null;
  location: string;
  channel: "Register" | "Online";
}

const METHOD_LABELS: Record<string, string> = {
  CARD_TERMINAL: "Card reader",
  TERMINAL: "Card reader",
  CARD_MANUAL: "Card (typed in)",
  GIFT_CARD: "Gift card",
  ACCOUNT_CREDIT: "Account credit",
  COMP: "Comp",
  CASH: "Cash",
};

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function posLineCategory(item: { itemType: string; category: string | null; metadata: unknown }): string {
  if (item.itemType === "RETAIL") {
    return isProductCategory(item.category) ? PRODUCT_CATEGORY_LABELS[item.category] : "Retail";
  }
  if (item.itemType === "DROP_IN") {
    const meta = metadataObject(item.metadata as never);
    return Array.isArray(meta.courseSessionIds) ? "Courses" : "Classes";
  }
  if (item.itemType === "MEMBERSHIP") return "Memberships";
  if (item.itemType === "GIFT_CARD") return "Gift cards";
  return "Custom";
}

function onlineCategory(p: { type: string; metadata: unknown }): string {
  if (p.type === "DROP_IN") return "Classes";
  if (p.type === "MEMBERSHIP") return "Memberships";
  if (p.type === "GIFT_CARD") return "Gift cards";
  if (p.type === "TIP") return "Tips";
  const meta = metadataObject(p.metadata as never);
  if (meta.kind === "clay") return PRODUCT_CATEGORY_LABELS.CLAY;
  if (meta.kind === "firing") return PRODUCT_CATEGORY_LABELS.FIRING;
  return "Other";
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const now = new Date();
  // Mountain Time days: midnight MT is 06:00Z (MDT) or 07:00Z (MST); the
  // wider bound keeps a sale at 11 pm on the last day in the range.
  const from = fromParam ? new Date(fromParam + "T06:00:00.000Z") : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : now;
  to.setUTCHours(to.getUTCHours() + 7);
  const locationId = searchParams.get("locationId");
  const locationFilter = locationId && locationId !== "__all__" ? { locationId } : {};

  const [orders, payments] = await Promise.all([
    prisma.posOrder.findMany({
      where: {
        status: { in: ["COMPLETED", "VOIDED"] },
        completedAt: { gte: from, lte: to },
        ...locationFilter,
      },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        payments: true,
        customer: { select: { name: true, email: true } },
        staff: { select: { name: true, email: true } },
        location: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: MAX_ROWS,
    }),
    prisma.payment.findMany({
      where: {
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        createdAt: { gte: from, lte: to },
        stripePaymentIntentId: { not: { startsWith: "pos_" } },
        ...locationFilter,
      },
      include: {
        user: { select: { name: true, email: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
  ]);

  // Class names and dates for online bookings and membership plan names.
  const bookingIds = payments.flatMap((p) => (p.bookingId ? [p.bookingId] : []));
  const membershipIds = payments.flatMap((p) => (p.membershipId ? [p.membershipId] : []));
  const [bookings, memberships] = await Promise.all([
    bookingIds.length
      ? prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: {
            id: true,
            studioSession: { select: { startsAt: true, title: true, sessionType: { select: { name: true, kind: true } } } },
          },
        })
      : [],
    membershipIds.length
      ? prisma.membership.findMany({
          where: { id: { in: membershipIds } },
          select: { id: true, plan: { select: { name: true } } },
        })
      : [],
  ]);
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const membershipById = new Map(memberships.map((m) => [m.id, m]));

  // Session dates for register class sales.
  const sessionIds = orders.flatMap((o) =>
    o.items.flatMap((i) => (i.itemType === "DROP_IN" ? [dropInSessionId(i.metadata)].filter((x): x is string => !!x) : [])),
  );
  const sessions = sessionIds.length
    ? await prisma.studioSession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, startsAt: true } })
    : [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const rows: SalesRow[] = [];

  for (const order of orders) {
    const voided = order.status === "VOIDED";
    const methods = [...new Set(order.payments.filter((p) => p.status !== "FAILED" && p.status !== "PENDING").map((p) => methodLabel(p.method)))];
    const paymentMethod = methods.length > 0 ? methods.join(" + ") : order.totalCents === 0 ? "Nothing to pay" : "—";
    const paymentIds = order.payments.flatMap((p) => (p.stripePaymentIntentId ? [p.stripePaymentIntentId] : []));
    const base = {
      paymentDate: (order.completedAt ?? order.createdAt).toISOString(),
      paymentMethod,
      paymentStatus: voided ? ("Voided" as const) : ("Paid" as const),
      reference: `#${order.orderNumber}`,
      paymentId: paymentIds.join(" ") || null,
      soldBy: order.staff.name ?? order.staff.email,
      customerName: order.customer?.name ?? order.walkInName ?? null,
      customerEmail: order.customer?.email ?? null,
      location: order.location.name,
      channel: "Register" as const,
    };
    for (const item of order.items) {
      const sessionId = item.itemType === "DROP_IN" ? dropInSessionId(item.metadata) : null;
      const serviceDate = sessionId ? (sessionById.get(sessionId)?.startsAt.toISOString() ?? null) : null;
      const meta = membershipLineMetadata(item.metadata);
      rows.push({
        id: item.id,
        category: posLineCategory(item),
        item: meta ? item.name : item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name,
        serviceDate,
        saleCents: item.totalCents,
        taxCents: item.taxCents,
        discountCents: item.discountCents,
        refundedCents: voided ? item.totalCents + item.taxCents : 0,
        ...base,
      });
    }
    if (order.tipCents > 0) {
      rows.push({
        id: `${order.id}-tip`,
        category: "Tips",
        item: "Tip",
        serviceDate: null,
        saleCents: order.tipCents,
        taxCents: 0,
        discountCents: 0,
        refundedCents: voided ? order.tipCents : 0,
        ...base,
      });
    }
  }

  for (const p of payments) {
    const booking = p.bookingId ? bookingById.get(p.bookingId) : null;
    const membership = p.membershipId ? membershipById.get(p.membershipId) : null;
    const meta = metadataObject(p.metadata as never);
    const sessionName = booking
      ? booking.studioSession.title ?? booking.studioSession.sessionType.name
      : null;
    const item =
      p.type === "DROP_IN"
        ? sessionName
          ? `${sessionName}, ${formatMountainTime(booking!.studioSession.startsAt, "datetime")}`
          : "Class booking"
        : p.type === "MEMBERSHIP"
          ? `${membership?.plan.name ?? "Membership"}${meta.billingReason === "subscription_cycle" ? " renewal" : ""}`
          : p.type === "GIFT_CARD"
            ? "Gift card"
            : p.type === "TIP"
              ? "Tip"
              : typeof meta.productName === "string"
                ? `${meta.productName}`
                : meta.kind === "firing"
                  ? "Glaze firing"
                  : "Online purchase";
    const refunded = p.status === "REFUNDED";
    rows.push({
      id: p.id,
      category: booking?.studioSession.sessionType.kind === "COURSE" ? "Courses" : onlineCategory(p),
      item,
      paymentDate: p.createdAt.toISOString(),
      serviceDate: booking ? booking.studioSession.startsAt.toISOString() : null,
      saleCents: p.amountInCents,
      taxCents: 0,
      discountCents: typeof meta.discountCents === "number" ? meta.discountCents : 0,
      refundedCents: refunded ? p.amountInCents : 0,
      paymentMethod: typeof meta.giftCardCents === "number" && meta.giftCardCents > 0 ? "Card + gift card" : "Card (online)",
      paymentStatus: refunded ? "Refunded" : "Paid",
      reference: p.stripeInvoiceId ?? p.stripePaymentIntentId,
      paymentId: p.stripePaymentIntentId.startsWith("inv_") ? null : p.stripePaymentIntentId,
      soldBy: "Online",
      customerName: p.user.name,
      customerEmail: p.user.email,
      location: p.location.name,
      channel: "Online",
    });
  }

  rows.sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0));

  if (searchParams.get("format") === "csv") {
    const header = [
      "Category", "Item", "Payment date", "Service date", "Sale value", "Tax", "Discount", "Refunded",
      "Payment method", "Payment status", "Sale reference", "Payment ID", "Sold by", "Customer name",
      "Customer email", "Location", "Channel",
    ];
    const lines = rows.map((r) =>
      [
        r.category, r.item,
        formatMountainTime(new Date(r.paymentDate), "datetime"),
        r.serviceDate ? formatMountainTime(new Date(r.serviceDate), "datetime") : null,
        dollars(r.saleCents), dollars(r.taxCents), dollars(r.discountCents), dollars(r.refundedCents),
        r.paymentMethod, r.paymentStatus, r.reference, r.paymentId, r.soldBy, r.customerName, r.customerEmail,
        r.location, r.channel,
      ].map(csvCell).join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales-${fromParam ?? "start"}-to-${toParam ?? "today"}.csv"`,
      },
    });
  }

  return NextResponse.json({
    rows,
    truncated: orders.length >= MAX_ROWS || payments.length >= MAX_ROWS,
  });
}
