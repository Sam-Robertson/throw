import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/consent";
import { parsePieceFields } from "./_shared";

// GET /api/pieces — the signed-in customer's own pieces, newest first.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pieces = await prisma.piece.findMany({
    where: { userId: session.user.id },
    include: {
      studioSession: { select: { id: true, startsAt: true, sessionType: { select: { name: true } } } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pieces);
}

// POST /api/pieces — log pieces made in a session (status INTAKE).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const b = raw as Record<string, unknown>;

  const fields = parsePieceFields(b, userId);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });

  const requestedSessionId =
    typeof b.studioSessionId === "string" && b.studioSessionId.trim() ? b.studioSessionId.trim() : null;

  let studioSessionId: string | null = null;
  let locationId: string | null = null;

  if (requestedSessionId) {
    // Any non-cancelled booking counts — a mistaken no-show mark shouldn't stop
    // someone logging what they made.
    const booking = await prisma.booking.findFirst({
      where: { userId, studioSessionId: requestedSessionId, status: { not: "CANCELLED" } },
      select: { studioSessionId: true, studioSession: { select: { locationId: true } } },
    });
    if (!booking) {
      return NextResponse.json({ error: "That session isn't one of your bookings" }, { status: 400 });
    }
    studioSessionId = booking.studioSessionId;
    locationId = booking.studioSession.locationId;
  }

  if (!locationId) {
    // Fall back to the studio of the customer's most recent booking, preferring
    // sessions that have already happened.
    const pastOrAny = async (pastOnly: boolean) =>
      prisma.booking.findFirst({
        where: {
          userId,
          status: { not: "CANCELLED" },
          studioSession: {
            locationId: { not: null },
            ...(pastOnly ? { startsAt: { lte: new Date() } } : {}),
          },
        },
        orderBy: { studioSession: { startsAt: "desc" } },
        select: { studioSession: { select: { locationId: true } } },
      });
    const recent = (await pastOrAny(true)) ?? (await pastOrAny(false));
    locationId = recent?.studioSession.locationId ?? null;
  }

  if (!locationId) {
    return NextResponse.json(
      {
        error:
          "We couldn't tell which studio your pieces are at. Choose the session you made them in, or ask the front desk to log them for you.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } });
  const rawPhone = fields.contactPhone ?? user?.phone ?? null;
  const contactPhone = rawPhone && rawPhone.replace(/\D/g, "").length >= 10 ? normalizePhone(rawPhone) : null;
  if (fields.textOptIn && !contactPhone) {
    return NextResponse.json({ error: "Add a phone number so we can text you when they're ready" }, { status: 400 });
  }
  // First phone number we've had for this account: keep it on the profile.
  if (contactPhone && !user?.phone) {
    await prisma.user.update({ where: { id: userId }, data: { phone: contactPhone } });
  }

  const piece = await prisma.piece.create({
    data: {
      userId,
      studioSessionId,
      locationId,
      groupName: fields.groupName,
      pieceCount: fields.pieceCount,
      description: fields.description,
      photoUrls: fields.photoUrls,
      sharePermission: fields.sharePermission,
      textOptIn: fields.textOptIn,
      contactName: user?.name ?? null,
      contactPhone,
      instructorName: fields.instructorName,
      status: "INTAKE",
    },
  });

  return NextResponse.json(piece, { status: 201 });
}
