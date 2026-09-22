import { type NextRequest, NextResponse } from "next/server";
import type { PieceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromMountainTime } from "@/lib/timezone";
import { normalizePhone } from "@/lib/consent";
import { forbiddenResponse, locationWhere, resolveLocationScope, scopeAllows, type LocationScope } from "@/lib/locationScope";
import { createCustomerFromContact, findCustomerByContact, parseCustomerContact } from "@/lib/customerContact";
import { ACTIVE_PIECE_STATUSES, NOT_PICKED_UP, isPieceStatus, parsePieceFields } from "@/app/api/pieces/_shared";
import { PIECE_INCLUDE, presentPiece, requireStaff } from "./_shared";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 300;

// GET /api/admin/pieces?locationId&status&from&to&q&userId&counts=1
//   status: a PieceStatus, or NOT_PICKED_UP (the kiln queue). Omitted = all.
//   counts=1: returns `{ counts: { INTAKE: n, … } }` for the other filters
//   instead of rows, for the status chips.
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
  if (status && status !== NOT_PICKED_UP && !isPieceStatus(status)) {
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
  const qDigits = q?.replace(/\D/g, "") ?? "";
  const userId = searchParams.get("userId");

  // Built separately so TS doesn't infer locationWhere's field from the
  // PieceWhereInput context.
  const scopeFilter = locationWhere(scope, "locationId");
  const baseWhere: Prisma.PieceWhereInput = {
    ...scopeFilter,
    ...(from || to ? { createdAt } : {}),
    ...(userId ? { userId } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { contactName: { contains: q, mode: "insensitive" } },
            { groupName: { contains: q, mode: "insensitive" } },
            ...(qDigits.length >= 4
              ? [
                  { contactPhone: { contains: qDigits } },
                  { user: { phone: { contains: qDigits } } },
                ]
              : []),
          ],
        }
      : {}),
  };

  if (searchParams.get("counts") === "1") {
    const grouped = await prisma.piece.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g._count._all;
    return NextResponse.json({ counts });
  }

  const statusFilter: Prisma.PieceWhereInput =
    status === NOT_PICKED_UP
      ? { status: { in: [...ACTIVE_PIECE_STATUSES] as PieceStatus[] } }
      : status && isPieceStatus(status)
        ? { status }
        : {};

  // Kiln-queue order: by stage (Postgres orders the enum by declaration),
  // oldest first within a stage so nothing sits forgotten at the bottom.
  const pieces = await prisma.piece.findMany({
    where: { ...baseWhere, ...statusFilter },
    include: PIECE_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: MAX_ROWS,
  });

  return NextResponse.json(pieces.map(presentPiece));
}

interface DeskIntakeBody {
  customerId?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  email?: unknown;
  studioSessionId?: unknown;
  locationId?: unknown;
  staffNote?: unknown;
  [key: string]: unknown;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

// POST /api/admin/pieces — log pieces at the front desk for a customer, or for
// a walk-in (creates a phone-only customer, like the register does).
export async function POST(req: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as DeskIntakeBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const locationId = str(body.locationId, 64);
  if (!locationId) return NextResponse.json({ error: "Choose a studio" }, { status: 400 });

  let scope: LocationScope;
  try {
    scope = resolveLocationScope(guard.session);
  } catch (err) {
    return forbiddenResponse(err);
  }
  if (!scopeAllows(scope, locationId)) {
    return NextResponse.json({ error: "You don't have access to that studio" }, { status: 403 });
  }
  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return NextResponse.json({ error: "Studio not found" }, { status: 404 });

  const studioSessionId = str(body.studioSessionId, 64);
  if (studioSessionId) {
    const studioSession = await prisma.studioSession.findUnique({
      where: { id: studioSessionId },
      select: { locationId: true },
    });
    if (!studioSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (studioSession.locationId && studioSession.locationId !== locationId) {
      return NextResponse.json({ error: "That session is at a different studio" }, { status: 400 });
    }
  }

  // Who the pieces belong to: an existing account, or a walk-in matched by
  // phone/email, or a brand-new phone-only customer.
  const select = { id: true, name: true, email: true, phone: true } as const;
  let customer: { id: string; name: string | null; email: string; phone: string | null } | null = null;
  let createdCustomer = false;
  const customerId = str(body.customerId, 64);
  if (customerId) {
    customer = await prisma.user.findUnique({ where: { id: customerId }, select });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  } else {
    const parsed = parseCustomerContact({ name: body.contactName, email: body.email, phone: body.contactPhone });
    if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: parsed.status });
    customer = await findCustomerByContact(parsed.value);
    if (!customer) {
      customer = await createCustomerFromContact(parsed.value);
      createdCustomer = true;
    }
  }

  // Photos may sit under the customer's prefix or the staff member's (a
  // walk-in has no account until this request creates one).
  const fields = parsePieceFields(body, [customer.id, guard.session.user.id]);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });

  const contactName = str(body.contactName, 200) ?? customer.name;
  const rawPhone = fields.contactPhone ?? customer.phone;
  const contactPhone = rawPhone && rawPhone.replace(/\D/g, "").length >= 10 ? normalizePhone(rawPhone) : null;
  if (fields.textOptIn && !contactPhone) {
    return NextResponse.json({ error: "Enter a phone number to text when the pieces are ready" }, { status: 400 });
  }

  // A customer with no phone on file gets the one they just gave us, so the
  // register can find them next time. Never overwrites a phone already there.
  if (contactPhone && !customer.phone) {
    await prisma.user.update({ where: { id: customer.id }, data: { phone: contactPhone } });
  }

  const piece = await prisma.piece.create({
    data: {
      userId: customer.id,
      studioSessionId,
      locationId,
      groupName: fields.groupName,
      pieceCount: fields.pieceCount,
      description: fields.description,
      photoUrls: fields.photoUrls,
      sharePermission: fields.sharePermission,
      textOptIn: fields.textOptIn,
      contactName,
      contactPhone,
      instructorName: fields.instructorName,
      staffNote: str(body.staffNote, 2000),
      loggedById: guard.session.user.id,
      status: "INTAKE",
    },
    include: PIECE_INCLUDE,
  });

  return NextResponse.json({ piece: presentPiece(piece), customer, createdCustomer }, { status: 201 });
}
