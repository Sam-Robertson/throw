import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, resolveLocationScope, scopeAllows, type LocationScope } from "@/lib/locationScope";
import { applyPieceUpdate } from "@/lib/pieceNotify";
import { parsePieceUpdate, requireStaff } from "../_shared";

// PATCH /api/admin/pieces/[id]?resend=1 — status, bagged and/or staff note.
// Moving to READY texts the customer (see src/lib/pieceNotify.ts); `resend=1`
// sends the ready text again for a piece that is already READY, with or
// without other changes in the body.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { id } = await params;
  const resend = new URL(req.url).searchParams.get("resend") === "1";
  const body = (await req.json().catch(() => null)) ?? {};
  const parsed = parsePieceUpdate(body);
  if (typeof parsed === "string" && !(resend && parsed === "Nothing to update")) {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  const update = typeof parsed === "string" ? {} : parsed;

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

  const result = await applyPieceUpdate(id, update, { resend });
  return NextResponse.json(result);
}
