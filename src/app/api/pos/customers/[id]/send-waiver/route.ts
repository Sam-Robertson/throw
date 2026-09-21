import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { isSuppressed, normalizeEmail, normalizePhone } from "@/lib/consent";
import { resend } from "@/lib/resend";
import { sendSms } from "@/lib/sms";
import { findUnsignedWaiver, waiverSignUrl } from "@/lib/waivers";
import { realEmail } from "@/lib/walkinEmail";

const DEFAULT_FROM = "Throw Art Studio <hello@throwartstudio.com>";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Texts or emails a customer the link to sign this studio's waiver. Body:
 * `{ locationId, channel?: "sms" | "email" }`; without a channel it texts when
 * there is a phone number, else emails. Transactional, so only the
 * suppression list (STOP replies, bounces) is checked, not marketing consent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { locationId?: string; channel?: string } | null;
  if (!body?.locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });

  const allowed = await checkPermission(session.user.id, "canUsePos", body.locationId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const waiver = await findUnsignedWaiver(id, body.locationId);
  if (!waiver) {
    return NextResponse.json(
      { error: "WAIVER_ON_FILE", message: "This customer's waiver is already on file." },
      { status: 409 },
    );
  }

  // The signing page asks them to sign in, which takes a real email address.
  const email = realEmail(customer.email);
  if (!email) {
    return NextResponse.json(
      {
        error: "NO_LOGIN_EMAIL",
        message: "This customer has no email on their account, so they can't sign in to sign online. Have them sign on the studio tablet instead.",
      },
      { status: 409 },
    );
  }

  const channel = body.channel === "sms" || body.channel === "email" ? body.channel : customer.phone ? "sms" : "email";
  const link = `${appUrl()}${waiverSignUrl(waiver.id, "/account")}`;
  const firstName = customer.name?.trim().split(/\s+/)[0];

  if (channel === "sms") {
    if (!customer.phone) {
      return NextResponse.json(
        { error: "NO_PHONE", message: "This customer has no phone number on file." },
        { status: 400 },
      );
    }
    const to = normalizePhone(customer.phone);
    if (await isSuppressed("SMS", to)) {
      return NextResponse.json(
        { error: "SUPPRESSED", message: "This number has opted out of texts. Email the link instead." },
        { status: 409 },
      );
    }
    const result = await sendSms({
      to,
      message: `${firstName ? `Hi ${firstName}, p` : "P"}lease sign the ${waiver.locationName} waiver before your class: ${link}`,
      userId: customer.id,
      kind: "transactional",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "SEND_FAILED", message: "The text could not be sent. Try email instead." },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, channel, to: customer.phone });
  }

  if (await isSuppressed("EMAIL", normalizeEmail(email))) {
    return NextResponse.json(
      { error: "SUPPRESSED", message: "This email address has bounced or unsubscribed. Text the link instead." },
      { status: 409 },
    );
  }
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: email,
      subject: `Please sign the ${waiver.locationName} waiver`,
      text: [
        `${firstName ? `Hi ${firstName},` : "Hi,"}`,
        "",
        `Please read and sign the ${waiver.locationName} waiver before your class:`,
        link,
        "",
        "Thank you!",
        "Throw Art Studio",
      ].join("\n"),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Failed to email waiver link:", err);
    return NextResponse.json(
      { error: "SEND_FAILED", message: "The email could not be sent." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, channel, to: email });
}
