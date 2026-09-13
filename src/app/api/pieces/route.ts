import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_PIECE_PHOTOS, isOwnPiecePhotoUrl } from "./_shared";

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

interface PieceInput {
  studioSessionId: string | null;
  groupName: string | null;
  pieceCount: number;
  description: string;
  photoUrls: string[];
  sharePermission: boolean;
}

function parseInput(raw: unknown, userId: string): PieceInput | string {
  if (!raw || typeof raw !== "object") return "Invalid request body";
  const b = raw as Record<string, unknown>;

  const studioSessionId =
    typeof b.studioSessionId === "string" && b.studioSessionId.trim() ? b.studioSessionId.trim() : null;

  const groupName =
    typeof b.groupName === "string" && b.groupName.trim() ? b.groupName.trim().slice(0, 120) : null;

  const pieceCount = typeof b.pieceCount === "number" ? b.pieceCount : Number(b.pieceCount);
  if (!Number.isInteger(pieceCount) || pieceCount < 1 || pieceCount > 100) {
    return "Piece count must be a whole number between 1 and 100";
  }

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!description) return "Please describe your pieces";
  if (description.length > 2000) return "Description is too long (2,000 characters max)";

  const photoUrls = Array.isArray(b.photoUrls) ? b.photoUrls : [];
  if (photoUrls.length > MAX_PIECE_PHOTOS) return `Up to ${MAX_PIECE_PHOTOS} photos per entry`;
  if (!photoUrls.every((u): u is string => typeof u === "string" && isOwnPiecePhotoUrl(u, userId))) {
    return "One of the photos isn't a valid upload";
  }

  const sharePermission = b.sharePermission === true;

  return { studioSessionId, groupName, pieceCount, description, photoUrls, sharePermission };
}

// POST /api/pieces — log pieces made in a session (status INTAKE).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const parsed = parseInput(await req.json().catch(() => null), userId);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  let studioSessionId: string | null = null;
  let locationId: string | null = null;

  if (parsed.studioSessionId) {
    // Any non-cancelled booking counts — a mistaken no-show mark shouldn't stop
    // someone logging what they made.
    const booking = await prisma.booking.findFirst({
      where: { userId, studioSessionId: parsed.studioSessionId, status: { not: "CANCELLED" } },
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

  const piece = await prisma.piece.create({
    data: {
      userId,
      studioSessionId,
      locationId,
      groupName: parsed.groupName,
      pieceCount: parsed.pieceCount,
      description: parsed.description,
      photoUrls: parsed.photoUrls,
      sharePermission: parsed.sharePermission,
      status: "INTAKE",
    },
  });

  return NextResponse.json(piece, { status: 201 });
}
