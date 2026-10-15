import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/consent";
import { issuePasswordEmail } from "@/lib/email/passwordSetup";
import {
  instructorSelect,
  locationNames,
  replaceAssignments,
  toInstructorRow,
  validateAssignments,
} from "@/lib/instructors";

/**
 * One instructor. PATCH edits their details, admin role and studio
 * assignments; DELETE takes them off the team (back to a customer account,
 * assignments removed, nothing else lost). POST /invite re-sends the
 * set-password email.
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || user.role === "CUSTOMER") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    assignments?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: { name?: string; email?: string; phone?: string | null; role?: "STAFF" | "ADMIN" } = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A real email address is required" }, { status: 400 });
    }
    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "Another account already uses that email" }, { status: 409 });
    data.email = email;
  }
  if (body.phone !== undefined) {
    data.phone = body.phone && body.phone.trim() ? normalizePhone(body.phone.trim()) : null;
  }
  if (body.role !== undefined) {
    if (body.role !== "STAFF" && body.role !== "ADMIN") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (session.user.id === id && body.role !== "ADMIN") {
      return NextResponse.json({ error: "You can't take away your own admin access" }, { status: 400 });
    }
    data.role = body.role;
  }

  let assignments: Awaited<ReturnType<typeof validateAssignments>> | null = null;
  if (body.assignments !== undefined) {
    assignments = await validateAssignments(body.assignments);
    if (typeof assignments === "string") return NextResponse.json({ error: assignments }, { status: 400 });
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id }, data });
  }
  if (assignments) await replaceAssignments(id, assignments);

  const row = await prisma.user.findUniqueOrThrow({ where: { id }, select: instructorSelect });
  return NextResponse.json(toInstructorRow(row, await locationNames()));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || user.role === "CUSTOMER") return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Back to a customer: the account, its history and its sessions as
  // instructor stay; only admin access and the studio assignments go.
  await prisma.$transaction([
    prisma.staffRoleAssignment.deleteMany({ where: { userId: id } }),
    prisma.user.update({ where: { id }, data: { role: "CUSTOMER" } }),
  ]);
  return NextResponse.json({ success: true });
}

/** POST /api/admin/instructors/[id] re-sends the set-password / reset email. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, hashedPassword: true, role: true },
  });
  if (!user || user.role === "CUSTOMER") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await issuePasswordEmail(user);
  if (!result.sent) {
    return NextResponse.json(
      { error: result.error ?? "The email could not be sent", mode: result.mode },
      { status: 502 },
    );
  }
  return NextResponse.json({ sent: true, mode: result.mode, to: user.email });
}
