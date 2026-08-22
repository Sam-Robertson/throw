import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

const SAMPLE: Record<string, string> = {
  customer_name: "Jane Smith",
  name: "Jane Smith",
  instructor_name: "Alex Johnson",
  appointment_date: "Saturday, June 1",
  date: "Saturday, June 1",
  appointment_time: "10:00 AM",
  time: "10:00 AM",
  appointment_type: "Wheel Throwing",
  session_type: "Wheel Throwing",
  studio_name: "Throw Studio",
  location: "Throw Studio",
  studio_phone: "(303) 555-0100",
  plan_name: "Open Studio Membership",
};

function fillVars(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE[key] ?? `{{${key}}}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { to: string };

  if (!body.to?.trim()) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const automation = await prisma.smsAutomation.findUnique({ where: { id } });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filled = fillVars(automation.messageTemplate);
  const result = await sendSms({
    to: body.to.trim(),
    message: filled,
    userId: session.user.id,
    automationId: automation.id,
    kind: "transactional",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
