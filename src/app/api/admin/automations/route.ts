import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRIGGERS = [
  "booking/confirmed",
  "booking/reminder",
  "booking/cancelled",
  "membership/created",
  "membership/paused",
] as const;

async function requireStaff() {
  const session = await auth();
  if (!session)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

export async function GET() {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const automations = await prisma.smsAutomation.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(automations);
}

export async function POST(request: NextRequest) {
  const guard = await requireStaff();
  if (guard.error) return guard.error;

  const { name, triggerEvent, delayMinutes, messageTemplate, locationId } =
    await request.json();

  if (!name?.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!triggerEvent || !VALID_TRIGGERS.includes(triggerEvent))
    return NextResponse.json({ error: "invalid triggerEvent" }, { status: 400 });
  if (!messageTemplate?.trim())
    return NextResponse.json({ error: "messageTemplate is required" }, { status: 400 });

  const automation = await prisma.smsAutomation.create({
    data: {
      name,
      triggerEvent,
      delayMinutes: delayMinutes ?? 0,
      messageTemplate,
      locationId: locationId ?? null,
    },
  });

  return NextResponse.json(automation, { status: 201 });
}
