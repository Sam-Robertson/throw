import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, resolveLocationScope, scopeAllows, type LocationScope } from "@/lib/locationScope";
import { applyPieceUpdate, type NotifyChannel } from "@/lib/pieceNotify";
import { parsePieceUpdate, requireStaff } from "../_shared";

const MAX_BULK = 300;

interface BulkPieceResult {
  id: string;
  ok: boolean;
  error?: string;
  status?: string;
  notified?: NotifyChannel;
  reason?: string;
}

// POST /api/admin/pieces/bulk { ids, status?, bagged? } — the same update as
// PATCH /api/admin/pieces/[id], applied to a kiln load. Pieces outside the
// caller's studios are reported, not touched. Returns per-piece notify
// results plus a summary of how many were texted or emailed.
export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids is required" }, { status: 400 });
  if (ids.length > MAX_BULK) return NextResponse.json({ error: `Up to ${MAX_BULK} pieces at a time` }, { status: 400 });

  const update = parsePieceUpdate({ status: body.status, bagged: body.bagged });
  if (typeof update === "string") return NextResponse.json({ error: update }, { status: 400 });

  let scope: LocationScope;
  try {
    scope = resolveLocationScope(guard.session);
  } catch (err) {
    return forbiddenResponse(err);
  }

  const pieces = await prisma.piece.findMany({
    where: { id: { in: ids } },
    select: { id: true, locationId: true },
  });
  const byId = new Map(pieces.map((p) => [p.id, p]));

  const results: BulkPieceResult[] = [];
  for (const id of Array.from(new Set(ids))) {
    const piece = byId.get(id);
    if (!piece) {
      results.push({ id, ok: false, error: "Piece not found" });
      continue;
    }
    if (!scopeAllows(scope, piece.locationId)) {
      results.push({ id, ok: false, error: "Outside your studios" });
      continue;
    }
    const r = await applyPieceUpdate(id, update);
    results.push({ id, ok: true, status: r.status, notified: r.notified, reason: r.reason });
  }

  const summary = {
    updated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    texted: results.filter((r) => r.notified === "sms").length,
    emailed: results.filter((r) => r.notified === "email").length,
  };

  return NextResponse.json({ results, summary });
}
