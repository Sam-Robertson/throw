import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, resolveLocationScope, scopeAllows, type LocationScope } from "@/lib/locationScope";
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

// PATCH /api/admin/pieces/[id] — change status only. No notifications yet.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (!body || !isPieceStatus(body.status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  const piece = await prisma.piece.findUnique({ where: { id }, select: { locationId: true } });
  if (!piece) return NextResponse.json({ error: "Piece not found" }, { status: 404 });

  let scope: LocationScope;
  try {
    scope = resolveLocationScope(guard.session);
  } catch (err) {
    return forbiddenResponse(err);
  }
  if (!scopeAllows(scope, piece.locationId)) {
    return NextResponse.json({ error: "You don't have access to that location" }, { status: 403 });
  }

  const updated = await prisma.piece.update({
    where: { id },
    data: { status: body.status },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}
