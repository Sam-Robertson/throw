import { stripe } from "@/lib/stripe";

/**
 * Stripe Tax for in-person POS sales.
 *
 * An in-person sale is taxed where it happens, so the studio's own address is
 * sent as the customer address. Only lines with a tax code are sent (see
 * src/config/taxCodes.ts); tips are never included.
 *
 * Tax must never block checkout: if tax is switched off for the location, the
 * location has no postal code, or Stripe Tax errors (e.g. not enabled on the
 * account), this returns zero tax with a `warning` the terminal shows as a
 * banner.
 */

export interface TaxLine {
  /** PosOrderItem id — Stripe echoes it back so tax can be stored per item. */
  reference: string;
  /** Line total after discounts, in cents. */
  amountCents: number;
  quantity: number;
  taxCode: string | null;
}

export interface TaxLocation {
  name: string;
  taxEnabled: boolean;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface TaxResult {
  /** taxcalc_... to turn into a tax transaction at completion; null when nothing was calculated. */
  calculationId: string | null;
  /** Tax per line, keyed by reference. Lines not in the map are untaxed. */
  taxByReference: Map<string, number>;
  totalTaxCents: number;
  warning: string | null;
}

function noTax(warning: string | null): TaxResult {
  return { calculationId: null, taxByReference: new Map(), totalTaxCents: 0, warning };
}

export async function calculatePosTax(location: TaxLocation, lines: TaxLine[]): Promise<TaxResult> {
  const taxable = lines.filter(
    (l): l is TaxLine & { taxCode: string } => l.taxCode !== null && l.amountCents > 0,
  );
  if (taxable.length === 0) return noTax(null);

  if (!location.taxEnabled) {
    return noTax(`Sales tax is turned off for ${location.name}. Charging without tax.`);
  }
  if (!location.postalCode || !location.state || !location.city || !location.addressLine1) {
    return noTax(
      `${location.name} has no full address on file, so tax can't be calculated. Charging without tax.`,
    );
  }

  try {
    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      line_items: taxable.map((l) => ({
        amount: l.amountCents,
        quantity: l.quantity,
        reference: l.reference,
        tax_code: l.taxCode,
        tax_behavior: "exclusive",
      })),
      customer_details: {
        address: {
          line1: location.addressLine1,
          city: location.city,
          state: location.state,
          postal_code: location.postalCode,
          country: "US",
        },
        address_source: "shipping",
      },
      expand: ["line_items"],
    });

    const taxByReference = new Map<string, number>();
    for (const li of calculation.line_items?.data ?? []) {
      taxByReference.set(li.reference, li.amount_tax);
    }
    const totalTaxCents = [...taxByReference.values()].reduce((sum, c) => sum + c, 0);

    // Calculates fine but collects nothing when the account has no
    // registration covering this address.
    const notCollecting =
      totalTaxCents === 0 &&
      calculation.tax_breakdown.some((b) => b.taxability_reason === "not_collecting");

    return {
      calculationId: calculation.id ?? null,
      taxByReference,
      totalTaxCents,
      warning: notCollecting
        ? "Stripe Tax isn't collecting tax for this studio's address (no Utah registration in Stripe yet?). Charging without tax."
        : null,
    };
  } catch (err) {
    const code = typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
    if (code === "stripe_tax_inactive") {
      console.warn("[stripeTax] Stripe Tax is not active on this Stripe account; charging without tax");
      return noTax(
        "Stripe Tax isn't turned on for this Stripe account yet, so tax isn't being added. Charging without tax.",
      );
    }
    console.error("[stripeTax] calculation failed:", err);
    return noTax("Tax couldn't be calculated (Stripe Tax unavailable). Charging without tax.");
  }
}

/**
 * Records the completed sale with Stripe Tax so it shows up in tax reports and
 * filings. Idempotent on `reference`. Never throws — a failure here must not
 * undo a sale that's already been paid for; it's logged for follow-up.
 */
export async function recordTaxTransaction(
  calculationId: string,
  reference: string,
): Promise<string | null> {
  try {
    const transaction = await stripe.tax.transactions.createFromCalculation(
      { calculation: calculationId, reference },
      { idempotencyKey: `pos-tax-${reference}` },
    );
    return transaction.id;
  } catch (err) {
    console.error(`[stripeTax] failed to record tax transaction for ${reference}:`, err);
    return null;
  }
}
