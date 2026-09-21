import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { sendInngestEvent } from "@/lib/inngest";
import { realEmail } from "@/lib/walkinEmail";
import { RECEIPT_CHOSEN_EVENT, loadReceiptOrder, sendReceipt, type ReceiptChannel } from "@/inngest/posReceipt";

const CHANNELS: ReceiptChannel[] = ["email", "sms", "none"];

/**
 * Sends (or declines) a completed order's receipt. Body:
 * `{ channel: "email" | "sms" | "none", to?: string }`. `to` overrides the
 * contact on file, e.g. a walk-in who types an email. With no body (the
 * "resend receipt" action) it emails the customer on file, or texts them when
 * there is no email.
 *
 * The receipt goes out from here, not through Inngest, so staff see at once
 * whether it worked. Whatever is chosen, the delayed automatic email that
 * `pos/order.completed` schedules is cancelled, so nobody gets two.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await loadReceiptOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkPermission(session.user.id, "canUsePos", order.locationId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed orders have a receipt" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { channel?: string; to?: string } | null;

  let channel: ReceiptChannel;
  if (body?.channel !== undefined) {
    if (!CHANNELS.includes(body.channel as ReceiptChannel)) {
      return NextResponse.json(
        { error: "INVALID_CHANNEL", message: "channel must be email, sms or none." },
        { status: 400 },
      );
    }
    channel = body.channel as ReceiptChannel;
  } else {
    channel = realEmail(order.customer?.email) || !order.customer?.phone ? "email" : "sms";
  }

  // Staff have decided how this receipt goes out: stop the automatic one.
  // Sent first so a slow email can't lose the race with the delayed send.
  await sendInngestEvent({ name: RECEIPT_CHOSEN_EVENT, data: { orderId: id, channel } });

  const result = await sendReceipt(order, channel, body?.to);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true, sent: result.sent, to: result.to });
}
