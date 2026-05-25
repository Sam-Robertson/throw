import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { twilioClient, TWILIO_PHONE } from "@/lib/twilio";
import { resend } from "@/lib/resend";

// POST /api/admin/inbox/[id]/messages — send a reply
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { body: string; subject?: string };

  if (!body.body?.trim())
    return NextResponse.json({ error: "body is required" }, { status: 400 });

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { user: { select: { email: true, phone: true, name: true } } },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();

  // Send via the right channel
  if (conversation.channel === "sms") {
    if (!conversation.user.phone)
      return NextResponse.json({ error: "Customer has no phone number" }, { status: 422 });
    await twilioClient.messages.create({
      body: body.body.trim(),
      from: TWILIO_PHONE,
      to: conversation.user.phone,
    });
  } else if (conversation.channel === "email") {
    await resend.emails.send({
      from: "Throw Studio <hello@throwstudio.com>",
      to: conversation.user.email,
      subject: body.subject ?? conversation.subject ?? "Message from Throw Studio",
      text: body.body.trim(),
    });
  }
  // "in_app" — just store the message, no external delivery

  const [message] = await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: "outbound",
        body: body.body.trim(),
        subject: body.subject ?? null,
        isRead: true,
        createdAt: now,
      },
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: now },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}
