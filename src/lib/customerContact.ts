import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "@/lib/consent";
import { generatePlaceholderEmail } from "@/lib/walkinEmail";

/**
 * Creating a customer from the front desk with only a name plus an email or a
 * phone number. Shared by the register (POST /api/pos/customers) and the
 * pieces desk intake (POST /api/admin/pieces). `User.email` is required, so a
 * phone-only customer gets a `walkin-…@walkin.invalid` placeholder that can
 * never receive mail (see src/lib/walkinEmail.ts); every sender skips those.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CustomerContact {
  name: string;
  /** Normalised (lower-cased), or null. */
  email: string | null;
  /** E.164, or null. */
  phone: string | null;
  /** Other spellings of the phone to match existing rows on. */
  phoneVariants: string[];
}

export type ParsedContact =
  | { ok: true; value: CustomerContact }
  | { ok: false; status: 400; error: string; message: string };

export function parseCustomerContact(input: {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
}): ParsedContact {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 200) : "";
  const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const phone = phoneDigits ? normalizePhone(rawPhone) : null;

  if (!name) {
    return { ok: false, status: 400, error: "NAME_REQUIRED", message: "Enter the customer's name." };
  }
  if (!email && !phone) {
    return {
      ok: false,
      status: 400,
      error: "CONTACT_REQUIRED",
      message: "Enter an email or a phone number so we can find them next time.",
    };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, error: "INVALID_EMAIL", message: "That email doesn't look right." };
  }
  if (phone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    return { ok: false, status: 400, error: "INVALID_PHONE", message: "That phone number doesn't look right." };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      phoneVariants: phone ? Array.from(new Set([phone, phoneDigits, rawPhone])) : [],
    },
  };
}

export const CUSTOMER_CONTACT_SELECT = { id: true, name: true, email: true, phone: true } as const;

/** One account per email. With no email, the phone is all there is to match on. */
export async function findCustomerByContact(contact: CustomerContact) {
  if (contact.email) {
    return prisma.user.findFirst({
      where: { email: { equals: contact.email, mode: "insensitive" } },
      select: CUSTOMER_CONTACT_SELECT,
    });
  }
  if (contact.phone) {
    return prisma.user.findFirst({
      where: { role: "CUSTOMER", phone: { in: contact.phoneVariants } },
      select: CUSTOMER_CONTACT_SELECT,
    });
  }
  return null;
}

export async function createCustomerFromContact(contact: CustomerContact) {
  return prisma.user.create({
    data: {
      name: contact.name,
      email: contact.email ?? generatePlaceholderEmail(),
      phone: contact.phone,
      role: "CUSTOMER",
    },
    select: CUSTOMER_CONTACT_SELECT,
  });
}
