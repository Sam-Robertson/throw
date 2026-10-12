import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { normalizeEmail, normalizePhone } from "@/lib/consent";
import { isValidEmail } from "@/lib/membershipLifecycle";

/**
 * Updates whichever profile fields the body carries. The account page edits
 * one thing at a time (a name sheet, an email sheet, ...), so a field that is
 * left out is left alone; an empty string clears an optional field.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };

  const data: Prisma.UserUpdateInput = {};

  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    const taken = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: session.user.id } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    data.email = email;
  }
  if (body.phone !== undefined) {
    data.phone = body.phone.trim() ? normalizePhone(body.phone.trim()) : null;
  }
  if (body.emergencyContactName !== undefined) {
    data.emergencyContactName = body.emergencyContactName.trim() || null;
  }
  if (body.emergencyContactPhone !== undefined) {
    data.emergencyContactPhone = body.emergencyContactPhone.trim()
      ? normalizePhone(body.emergencyContactPhone.trim())
      : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      role: true,
      createdAt: true,
      stripeCustomerId: true,
    },
  });

  // Receipts and billing emails go to the Stripe customer, so it follows.
  if ((data.email || data.name) && updated.stripeCustomerId) {
    await stripe.customers
      .update(updated.stripeCustomerId, {
        ...(data.email ? { email: updated.email } : {}),
        ...(data.name ? { name: updated.name ?? undefined } : {}),
      })
      .catch((err) => console.error("[account/profile] Stripe customer update:", err));
  }

  const { stripeCustomerId: _omit, ...publicFields } = updated;
  void _omit;
  return NextResponse.json(publicFields);
}
