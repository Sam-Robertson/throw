import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { inngest } from "@/lib/inngest";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(session.user.id, "canUsePos");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const order = await prisma.posOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed orders have a receipt" }, { status: 409 });
  }

  // Unlike other call sites, sending is this route's entire purpose (it's
  // the "resend receipt" action) — so unlike sendInngestEvent's
  // swallow-and-log elsewhere, a failure here should actually be reported
  // to the caller rather than silently returning ok:true.
  try {
    await inngest.send({ name: "pos/order.completed", data: { orderId: id } });
  } catch (err) {
    console.error("Failed to resend POS receipt:", err);
    return NextResponse.json({ error: "Failed to send receipt" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
