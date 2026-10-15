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
 * Instructors and other staff: the people with admin access, with the studios
 * they work at (their StaffRoleAssignment rows) and their current pay rate.
 *
 * GET  — every STAFF and ADMIN user, with assignments and pay rate.
 * POST — adds an instructor directly: by email, creating the account when
 *        there is none (or promoting the customer who has it), assigning
 *        them a role at each chosen studio, and emailing them a link to set
 *        their password. No more promoting a customer from a dropdown.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, names] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      select: instructorSelect,
      orderBy: { name: "asc" },
    }),
    locationNames(),
  ]);
  return NextResponse.json(users.map((u) => toInstructorRow(u, names)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    assignments?: unknown;
    sendInvite?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A real email address is required" }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";
  const phone = typeof body.phone === "string" && body.phone.trim() ? normalizePhone(body.phone.trim()) : null;

  const assignments = await validateAssignments(body.assignments ?? []);
  if (typeof assignments === "string") return NextResponse.json({ error: assignments }, { status: 400 });

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true, name: true },
  });
  if (existing && existing.role !== "CUSTOMER") {
    return NextResponse.json(
      { error: `${existing.name ?? email} is already on the team. Edit them instead.` },
      { status: 409 },
    );
  }
  if (!existing && !name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // A customer with this email keeps their account (bookings, pieces, history)
  // and gains admin access; anyone else gets a fresh account with no
  // password, which the invite email lets them set.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role, ...(name ? { name } : {}), ...(phone ? { phone } : {}) },
        select: { id: true, email: true, name: true, hashedPassword: true },
      })
    : await prisma.user.create({
        data: { email, name, phone, role },
        select: { id: true, email: true, name: true, hashedPassword: true },
      });

  await replaceAssignments(user.id, assignments);

  let invite: { sent: boolean; error?: string } = { sent: false };
  if (body.sendInvite !== false) {
    invite = await issuePasswordEmail(user);
  }

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: instructorSelect });
  return NextResponse.json(
    { ...toInstructorRow(row, await locationNames()), promoted: Boolean(existing), invite },
    { status: 201 },
  );
}
