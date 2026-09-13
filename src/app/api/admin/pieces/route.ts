import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromMountainTime } from "@/lib/timezone";
import { forbiddenResponse, locationWhere, resolveLocationScope, type LocationScope } from "@/lib/locationScope";
import { isPieceStatus } from "@/app/api/pieces/_shared";

type GuardResult = { error: NextResponse; session: null } | { error: null; session: Session };

async function requireStaff(): Promise<GuardResult> {
  const session = await auth();
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  return { error: null, session };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 300;

// GET /api/admin/pieces?locationId&status&from&to&q&userId
export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);

  let scope: LocationScope;
  try {
    scope = resolveLocationScope(guard.session, searchParams.get("locationId"));
  } catch (err) {
    return forbiddenResponse(err);
  }

  const status = searchParams.get("status");
  if (status && !isPieceStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: "from/to must be yyyy-MM-dd" }, { status: 400 });
  }

  // from/to are Mountain calendar dates; to is inclusive of the whole day.
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = fromMountainTime(from, "00:00");
  if (to) createdAt.lte = new Date(fromMountainTime(to, "23:59").getTime() + 59_999);

  const q = searchParams.get("q")?.trim();
  const userId = searchParams.get("userId");

  // Built separately so TS doesn't infer locationWhere's field from the
  // PieceWhereInput context.
  const scopeFilter = locationWhere(scope, "locationId");
  const where: Prisma.PieceWhereInput = {
    ...scopeFilter,
    ...(status && isPieceStatus(status) ? { status } : {}),
    ...(from || to ? { createdAt } : {}),
    ...(userId ? { userId } : {}),
    ...(q
      ? {
          user: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const pieces = await prisma.piece.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      studioSession: {
        select: { id: true, startsAt: true, sessionType: { select: { name: true } } },
      },
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  return NextResponse.json(
    pieces.map((p) => ({
      id: p.id,
      userId: p.userId,
      groupName: p.groupName,
      pieceCount: p.pieceCount,
      description: p.description,
      photoUrls: p.photoUrls,
      sharePermission: p.sharePermission,
      status: p.status,
      weightOz: p.weightOz,
      chargedCents: p.chargedCents,
      createdAt: p.createdAt,
      user: p.user,
      location: p.location,
      studioSession: p.studioSession
        ? {
            id: p.studioSession.id,
            startsAt: p.studioSession.startsAt,
            sessionTypeName: p.studioSession.sessionType.name,
          }
        : null,
    })),
  );
}
