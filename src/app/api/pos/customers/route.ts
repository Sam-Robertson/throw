import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import {
  createCustomerFromContact,
  findCustomerByContact,
  parseCustomerContact,
} from "@/lib/customerContact";

/**
 * Creates a customer from the register without leaving the sale: a name plus
 * an email or a phone number. `User.email` is required, so a phone-only
 * customer gets a `walkin-…@walkin.invalid` placeholder that can never receive
 * mail (see src/lib/walkinEmail.ts); every sender skips those addresses.
 * The matching and creation live in src/lib/customerContact.ts, shared with
 * the pieces desk intake.
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

  const parsed = parseCustomerContact(body ?? {});
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, message: parsed.message }, { status: parsed.status });
  }

  const existing = await findCustomerByContact(parsed.value);
  if (existing) {
    return NextResponse.json(
      {
        error: "CUSTOMER_EXISTS",
        message: `${existing.name ?? "A customer"} already has an account with that ${parsed.value.email ? "email" : "phone number"}. Attach them to this order instead?`,
        customer: existing,
      },
      { status: 409 },
    );
  }

  const customer = await createCustomerFromContact(parsed.value);
  return NextResponse.json(customer, { status: 201 });
}
