import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/consent";
import { getTicketBalance } from "@/lib/credits";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      role: true,
      createdAt: true,
      memberships: {
        include: {
          plan: { select: { name: true, price: true, classTicketsPerPeriod: true } },
          membershipEvents: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        include: {
          studioSession: {
            include: {
              sessionType: { select: { name: true } },
              location: { select: { name: true } },
            },
          },
        },
        orderBy: { studioSession: { startsAt: "desc" } },
      },
      waiverSignatures: {
        include: {
          waiverVersion: { select: { version: true, locationId: true } },
        },
        orderBy: { signedAt: "desc" },
      },
      linkedTasks: {
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer || customer.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const currentMembership = customer.memberships.find(
    (m) => m.status === "ACTIVE" || m.status === "PAUSED",
  );

  let ticketBalance = null;
  let creditLedger: unknown[] = [];
  if (currentMembership) {
    ticketBalance = await getTicketBalance(currentMembership.id);
    if (!ticketBalance.unlimited) {
      creditLedger = await prisma.membershipCreditLedger.findMany({
        where: { membershipId: currentMembership.id },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  return NextResponse.json({ ...customer, ticketBalance, creditLedger });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    name?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() || null }),
      ...(body.phone !== undefined && {
        phone: body.phone.trim() ? normalizePhone(body.phone.trim()) : null,
      }),
      ...(body.emergencyContactName !== undefined && {
        emergencyContactName: body.emergencyContactName.trim() || null,
      }),
      ...(body.emergencyContactPhone !== undefined && {
        emergencyContactPhone: body.emergencyContactPhone.trim() || null,
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  });

  return NextResponse.json(updated);
}
