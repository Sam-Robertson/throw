import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { studioSession: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  if (booking.studioSession.startsAt <= twoHoursFromNow) {
    return NextResponse.json(
      { error: "Too late to cancel (within 2 hour window)" },
      { status: 400 },
    );
  }

  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await inngest.send({
    name: "booking/cancelled",
    data: {
      bookingId: id,
      userId: session.user.id,
      studioSessionId: booking.studioSessionId,
    },
  });

  let refundNote: string | undefined;
  if (booking.source === "DROP_IN" && booking.amountPaidCents > 0) {
    refundNote =
      "Your booking has been cancelled. Refund requests must be made directly with the studio.";
  }

  return NextResponse.json({ success: true, ...(refundNote && { refundNote }) });
}
