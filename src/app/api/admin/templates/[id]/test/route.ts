import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { sendSms } from "@/lib/sms";

// Sample values used to fill template variables in test sends
const SAMPLE: Record<string, string> = {
  customer_name: "Jane Smith",
  customer_email: "jane@example.com",
  instructor_name: "Alex Johnson",
  appointment_date: "Saturday, June 1",
  appointment_time: "10:00 AM",
  appointment_type: "Wheel Throwing",
  studio_name: "Throw Studio",
  studio_address: "123 Clay Street, Denver, CO 80203",
  studio_phone: "(303) 555-0100",
  payment_link: "https://checkout.stripe.com/pay/test-link",
  penalty_amount: "$25.00",
  cancellation_reason: "This appointment was cancelled by the studio.",
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
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { to: string };

  if (!body.to?.trim()) {
    return NextResponse.json({ error: "to is required" }, { status: 400 });
  }

  const template = await prisma.transactionalTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const filledBody = fillVars(template.body);

  if (template.channel === "sms") {
    const result = await sendSms({
      to: body.to.trim(),
      message: filledBody,
      userId: session.user.id,
      kind: "transactional",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 502 });
    }
  } else {
    const rawSubject = template.subject ?? template.name;
    const filledSubject = fillVars(rawSubject);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@throw.studio",
      to: body.to.trim(),
      subject: `[TEST] ${filledSubject}`,
      text: filledBody,
    });
  }

  return NextResponse.json({ ok: true });
}
