import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/permissions";
import { normalizeEmail, normalizePhone } from "@/lib/consent";
import { generatePlaceholderEmail } from "@/lib/walkinEmail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a customer from the register without leaving the sale: a name plus
 * an email or a phone number. `User.email` is required, so a phone-only
 * customer gets a `walkin-…@walkin.invalid` placeholder that can never receive
 * mail (see src/lib/walkinEmail.ts); every sender skips those addresses.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    locationId?: string;
  } | null;

  const allowed = await checkPermission(session.user.id, "canUsePos", body?.locationId || undefined);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const name = body?.name?.trim().slice(0, 200) ?? "";
  const email = body?.email?.trim() ? normalizeEmail(body.email) : null;
  const phoneDigits = body?.phone?.replace(/\D/g, "") ?? "";
  const phone = phoneDigits ? normalizePhone(body!.phone!.trim()) : null;

  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED", message: "Enter the customer's name." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "CONTACT_REQUIRED", message: "Enter an email or a phone number so we can find them next time." },
      { status: 400 },
    );
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL", message: "That email doesn't look right." }, { status: 400 });
  }
  if (phone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    return NextResponse.json(
      { error: "INVALID_PHONE", message: "That phone number doesn't look right." },
      { status: 400 },
    );
  }

  // One account per email. With no email, the phone is all there is to match on.
  const select = { id: true, name: true, email: true, phone: true } as const;
  const existing = email
    ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select })
    : await prisma.user.findFirst({
        where: { role: "CUSTOMER", phone: { in: [phone!, phoneDigits, body!.phone!.trim()] } },
        select,
      });
  if (existing) {
    return NextResponse.json(
      {
        error: "CUSTOMER_EXISTS",
        message: `${existing.name ?? "A customer"} already has an account with that ${email ? "email" : "phone number"}. Attach them to this order instead?`,
        customer: existing,
      },
      { status: 409 },
    );
  }

  const customer = await prisma.user.create({
    data: { name, email: email ?? generatePlaceholderEmail(), phone, role: "CUSTOMER" },
    select,
  });

  return NextResponse.json(customer, { status: 201 });
}
