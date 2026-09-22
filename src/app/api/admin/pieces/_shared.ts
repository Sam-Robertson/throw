import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import type { PieceUpdate } from "@/lib/pieceNotify";
import { isPieceStatus } from "@/app/api/pieces/_shared";

// Server-only helpers for the admin piece routes (list, desk intake, PATCH,
// bulk). Route files can't export anything but handlers, so these live here.

type GuardResult = { error: NextResponse; session: null } | { error: null; session: Session };

export async function requireStaff(): Promise<GuardResult> {
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

export const PIECE_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  loggedBy: { select: { id: true, name: true } },
  studioSession: {
    select: {
      id: true,
      startsAt: true,
      sessionType: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  },
  location: { select: { id: true, name: true } },
} satisfies Prisma.PieceInclude;

export type PieceWithIncludes = Prisma.PieceGetPayload<{ include: typeof PIECE_INCLUDE }>;

/** The row shape the admin list and desk intake page work with. */
export function presentPiece(p: PieceWithIncludes) {
  return {
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
    contactName: p.contactName,
    contactPhone: p.contactPhone,
    textOptIn: p.textOptIn,
    instructorName: p.instructorName,
    staffNote: p.staffNote,
    bagged: p.bagged,
    readyNotifiedAt: p.readyNotifiedAt,
    pickedUpAt: p.pickedUpAt,
    createdAt: p.createdAt,
    user: p.user,
    loggedBy: p.loggedBy,
    location: p.location,
    studioSession: p.studioSession
      ? {
          id: p.studioSession.id,
          startsAt: p.studioSession.startsAt,
          sessionTypeName: p.studioSession.sessionType.name,
          instructorName: p.studioSession.instructor?.name ?? null,
        }
      : null,
  };
}

export type PresentedPiece = ReturnType<typeof presentPiece>;

/** Validates `{ status?, bagged?, staffNote? }`; at least one must be present. */
export function parsePieceUpdate(body: unknown): PieceUpdate | string {
  if (!body || typeof body !== "object") return "Invalid request body";
  const b = body as Record<string, unknown>;
  const update: PieceUpdate = {};
  if (b.status !== undefined) {
    if (!isPieceStatus(b.status)) return "Invalid status";
    update.status = b.status;
  }
  if (b.bagged !== undefined) {
    if (typeof b.bagged !== "boolean") return "bagged must be true or false";
    update.bagged = b.bagged;
  }
  if (b.staffNote !== undefined) {
    if (b.staffNote !== null && typeof b.staffNote !== "string") return "staffNote must be text";
    const note = b.staffNote === null ? "" : b.staffNote.trim();
    if (note.length > 2000) return "Note is too long (2,000 characters max)";
    update.staffNote = note || null;
  }
  if (Object.keys(update).length === 0) return "Nothing to update";
  return update;
}
