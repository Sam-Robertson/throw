# POS and online checkout API

This is the contract the POS UI is built against: the order shape, the catalog payload, every new or
changed route with its request, response and error codes, what happens when an order completes, and the
discount engine's rules. It was written with the Prompt 5 server work (2026-09-19, see
`docs/catalog-audit.md` › Prompt 5 results). The server code is the source of truth: `src/lib/pos.ts`,
`src/lib/discounts.ts`, `src/lib/firing.ts`, `src/lib/bookingCheckout.ts` and `src/app/api/pos/**`.

---

Every route needs a session and `canUsePos` at the order's studio: 401 `{error:"Unauthorized"}`, 403 `{error:"Forbidden"}`. Every mutating order route returns 409 `{error:"Order is not open"}` when the status is not OPEN. Newer routes return errors as `{ error: CODE, message: "staff-facing text" }`. Older ones return `{ error: "text" }`. Show `message ?? error`.

### Order shape (every order response)
A `PosOrder` with `items`, `payments`, `customer {id,name,email}` and a new `discounts` array. Most mutating routes also add `taxWarning: string | null`.
- **`discounts[]`:** `{ id, orderId, discountCodeId, name, amountCents, automatic, note, appliedById, createdAt, discountCode: { id, code, type: "percent"|"fixed_cents", value, scope, appliesVia } }`.
- **`items[]` new or changed fields:**
  - `note: string|null`
  - `category: string|null`, set on RETAIL lines from the product; null on others.
  - `discountCents`: the line's whole discount, meaning the manual discount plus its share of named discounts.
  - `totalCents`: post-discount.
  - `metadata`, always containing `manualDiscountCents` (int) after a reprice.
- **`metadata` on RETAIL lines:**
  - Always: `productSlug`, `unit: "EACH"|"LB"`.
  - Optional: `membersOnly: true`, `classCredits`.
  - For by-weight lines: `weightLb`, `weightTenths`, `rateCentsPerLb`.
- **`metadata` on firing lines:** also `kind:"MEMBER_FIRING"`, `oversize`, `minChargeCents`, `minimumApplied`, `pieceId?`.
- **`order.discountCents`** is the sum of line `discountCents`.
- **Sum of `discounts[].amountCents`** is the named discounts only.
- **Manual discounts** are the sum of `metadata.manualDiscountCents`.
- **Tax** is calculated by Stripe Tax on post-discount line totals.

### GET `/api/pos/catalog?locationId=`
Existing keys `sessionTypes`, `membershipPlans` and `upcomingSessions` are unchanged. Changed and new keys:
- **`retailProducts`:** now only category RETAIL, in the legacy shape `{id,name,priceCents,stock,trackInventory}`. The old panel keeps working.
- **`products[]`:** every sellable product (active, priced, not archived) as `{ id, slug, name, description, category: "RETAIL"|"PIECES"|"FIRING"|"CLAY"|"CLASS_PACK"|"SHIPPING", unit: "EACH"|"LB", priceCents (per lb when unit LB), isPriced (always true here), minChargeCents|null, membersOnly, trackInventory, stock: number|null (null = not tracked), classCredits|null, imageUrl, sortOrder }`.
- **`productGroups[]`:** `{ category, label, products[] }` in catalog order; empty groups are omitted.
- **`staffDiscounts[]`:** STAFF-applicable, active, in date, for this studio. Each is `{ id, code, name, description, type, value, scope, sessionTypeId, sessionTypeName, productSlug, maxUnits, maxUsesPerCustomerPerYear, requiresNote, requiresGroupEvent, requiresCustomer }`.
- **`groupEventSessions[]`:** `{ id, name, startsAt }`. These are group-event sessions at this studio from 6 days ago through the class-list horizon, for `requiresGroupEvent` discounts.
- **`firingRates`:** `{ standardCentsPerLb, oversizeCentsPerLb, minChargeCents, standardProductId, oversizeProductId } | null`. It is null when the firing products are missing or inactive. The UI can import the pure `quoteMemberFiring` from `@/lib/firing` for a live preview with these rates.

### POST `/api/pos/orders/[id]/items` (changed)
- **Body:** `{ itemType, refId?, name?, quantity?, unitPriceCents?, weightLb?, note?, metadata? }`. Returns 201 with the order plus `taxWarning`.
- **RETAIL (`refId` = product id):**
  - The server sets `category`, `taxCode` (the product's code, else the category default) and `metadata`. Client metadata is ignored for RETAIL.
  - Unit LB products require `weightLb`. Price is the rate times weight rounded to 0.1 lb, then to the cent, then `minChargeCents`. Quantity is forced to 1 and the name becomes e.g. "B-Mix, 12.5 lb".
  - Stock is checked only when `trackInventory` is true.
- **RETAIL errors:**
  - 404 Retail product not found.
  - 409 `Product is not active`.
  - 409 `NOT_PRICED`.
  - 400 `WRONG_LOCATION`.
  - 403 `MEMBERS_ONLY`: the customer must be an ACTIVE member, or hold a CONFIRMED booking in a COURSE-kind class starting in the last 90 days or later.
  - 400 `CUSTOMER_REQUIRED` for CLASS_PACK with no customer.
  - 400 `WEIGHT_REQUIRED`.
  - 400 `INVALID_WEIGHT`.
  - 409 `Only N in stock`.
- **GIFT_CARD:** any positive `unitPriceCents`, so custom amounts work. Never discounted, never taxed.
- **DROP_IN, MEMBERSHIP, CUSTOM and legacy `metadata.kind:"FIRING"` custom lines:** unchanged.

### PATCH `/api/pos/orders/[id]/items/[itemId]` (changed)
- **Body:** `{ quantity?, discountCents?, note? }`.
  - `discountCents` is the manual line discount only. It is capped at the line gross and stored in `metadata.manualDiscountCents`; the response's `discountCents` includes named shares.
  - `note: null|""` clears the note; notes are capped at 500 characters.
- **Errors:**
  - 400 `QUANTITY_LOCKED` for DROP_IN, legacy firing, member firing and any unit-LB line.
  - 409 `Only N in stock` when raising the quantity on a tracked product.

DELETE is unchanged and reprices.

### POST `/api/pos/orders/[id]/firing` (new)
- **Body:** `{ pieces: [{ weightLb: number, oversize: boolean, pieceId?: string, note?: string }], dryRun?: boolean }`. 1 to 50 pieces.
- **Responses:**
  - dryRun → 200 `{ quote, rates }`.
  - Otherwise → 201 with the order plus `{ taxWarning, quote }`.
  - `quote` = `{ ok:true, lines:[{index, weightTenths, weightLb, oversize, rateCentsPerLb, weightChargeCents, chargeCents, minimumApplied}], totalCents, totalWeightTenths }`.
- **Lines created:** one RETAIL line per piece. `refId` is the standard or oversize product, category FIRING, quantity 1, named e.g. "Glaze firing, oversize, 1.3 lb".
- **`pieceId`** is an optional INTAKE `Piece` of the customer. On completion its `weightOz`, `chargedCents` and `posOrderItemId` are written.
- **Errors:**
  - 400 missing, empty or over 50 `pieces`.
  - 409 `FIRING_NOT_CONFIGURED`.
  - 403 `MEMBERS_ONLY`.
  - 400 `INVALID_WEIGHT` with `pieceIndex`.
- **Bisque firing** ($0) is an ordinary product; add it via `/items`. It is `membersOnly`.

### POST `/api/pos/orders/[id]/discounts` (new)
- **Body:** `{ discountCodeId?: string, code?: string, note?: string, groupEventSessionId?: string }`. One of id or code is required; codes are case-insensitive.
- **Response:** 201 with the order plus `{ taxWarning, discountWarning }`. `discountWarning` is set when the discount attached but currently takes $0 off; it stays on the order and starts working once a qualifying line is added.
- **Errors:**
  - 400 missing id or code.
  - 404 `DISCOUNT_NOT_FOUND`.
  - 400 `DISCOUNT_AUTOMATIC`.
  - 409 `ALREADY_APPLIED`.
  - 409 `PAYMENT_STARTED` when the order has a PENDING or SUCCEEDED payment.
  - 400 `GROUP_EVENT_NOT_FOUND`. The session must be a group event at this studio that started within 7 days ago. "Group event" means a class type with `priceUnit` FLAT, `isPublic` false and `isBusyWindow` false.
  - 400 `CUSTOMER_REQUIRED`, `NOTE_REQUIRED` or `GROUP_EVENT_REQUIRED`.
  - 409 `DISCOUNT_INACTIVE`, `DISCOUNT_NOT_STARTED`, `DISCOUNT_EXPIRED`, `DISCOUNT_USED_UP`, `DISCOUNT_WRONG_LOCATION` or `DISCOUNT_CUSTOMER_LIMIT`.
- The group event is recorded at the start of the discount's `note` as `Group event: <name>, <date> [<sessionId>] — <staff note>`.

### DELETE `/api/pos/orders/[id]/discounts/[discountId]` (new)
- **`discountId`** is the PosOrderDiscount id.
- **Response:** 200 with the order plus `taxWarning`.
- **Errors:**
  - 404 Discount not found.
  - 400 `DISCOUNT_AUTOMATIC`; remove the customer instead.
  - 409 `PAYMENT_STARTED`.

### PATCH `/api/pos/orders/[id]` (changed)
- **Body:** `{ customerId?, note?, tipCents?, walkInName?, walkInPhone? }`.
- **Customer change:** reprices the order. Automatic member discounts attach or detach, and the response now includes `taxWarning`.
- **Errors:**
  - 404 Customer not found.
  - 409 `CUSTOMER_LOCKED`. It now triggers when the order has a drop-in, a class pack or any discount and also a PENDING or SUCCEEDED payment.

### Payment precheck (`checkOrderPayable`, every tender route)
Adds these blocks:
- 400 `CUSTOMER_REQUIRED` for a class pack with no customer.
- 409 `MEMBERS_ONLY`: a members-only line and the current customer is not eligible.
- 400 or 409 `CUSTOMER_REQUIRED` / `DISCOUNT_CUSTOMER_LIMIT`: a per-customer discount with no customer, or the customer is already at the limit.

### POST `/api/pos/orders/[id]/payments/account-credit` (new)
- **Body:** `{ amountCents }`, a positive integer.
- **Behaviour:** applies `min(amountCents, balance owed, customer credit)` and decrements atomically, never below zero. It creates PosPayment `method:"ACCOUNT_CREDIT"` with status SUCCEEDED and `externalRef` set to the customerId, then runs completion.
- **Response:** 200 `{ order, amountApplied, accountCreditRemainingCents }`.
- **Errors:**
  - 400 `CUSTOMER_REQUIRED`.
  - 400 bad amount.
  - 409 `NO_ACCOUNT_CREDIT`.
  - 400 `There is no remaining balance to charge`.
  - Every precheck error.

### POST `…/payments/gift-card`
Same contract as before. Lookup is now dash- and space-insensitive and the decrement is atomic. There is a new 409 for when the balance changed mid-request.

### DELETE `…/payments/[paymentId]` (changed)
Removing a SUCCEEDED ACCOUNT_CREDIT payment returns the credit to the `externalRef` user. It now responds with the full order shape, discounts included.

### POST `/api/pos/orders/[id]/void` (changed)
- SUCCEEDED GIFT_CARD and ACCOUNT_CREDIT payments are restored and marked `REFUNDED`. Card payments are still not refunded here.
- For completed orders, class pack credits are taken back (a `VOID` ledger row, never below zero) and the discounts' `usedCount` is released.
- Redemption rows stay as history, and redemptions of voided orders are not counted toward limits.

### GET `/api/pos/customers/[id]/summary?locationId=` (new)
`locationId` is required. 400 without it, 404 Customer not found.
```
{ customer: {id,name,email,phone},
  membership: { id, planId, planName, tier, status: "ACTIVE"|"PAUSED", currentPeriodEnd, commitmentMonths } | null,
  tickets: { remaining: number|null, unlimited: boolean } | null,
  accountCreditCents, giftCards: [{id, code, balanceCents}], giftCardBalanceCents,
  classPackCredits,
  todaysBookings: [{ id, status, source, quantity, studioSessionId, name, sessionTypeId, sessionTypeSlug, kind, startsAt, endsAt }],
  waiverOnFile: boolean, canUseMemberFiring: boolean }
```
- **`giftCards`:** cards with `purchasedById` or `redeemedById` equal to this user and a balance above 0.
- **`todaysBookings`:** CONFIRMED or WAITLIST bookings at that studio, on the Mountain Time day.

### Completion side effects added (`maybeCompletePosOrder`)
- Stock is decremented only for `trackInventory` products.
- One `ClassCreditLedger` PURCHASE row per class pack line: `delta = classCredits × quantity`, with `posOrderItemId` set.
- For each named discount with `amountCents > 0`: one `DiscountRedemption` (`posOrderId`, `userId`, `amountCents`, `note`) plus `usedCount + 1`.

### Discount engine rules (`src/lib/discounts.ts`), for UI copy
- **Order of application:** manual line discount first, then automatic, then percent, then fixed. Ties go by time applied, then id.
- **Stacking:** each discount works on what is left of the line, so 20% then 10% is 28%. A line never goes below zero.
- **`maxUnits`** discounts the most expensive eligible units first.
- **Scopes:**
  - RETAIL is category RETAIL only. It never touches PIECES, FIRING, CLAY, CLASS_PACK, SHIPPING, CUSTOM or gift cards.
  - PIECES is category PIECES.
  - CLASSES is DROP_IN lines.
  - EVERYTHING is all lines except GIFT_CARD and MEMBERSHIP.
- **Automatic discounts:** the customer's ACTIVE membership commitment (`CommitmentTerm.months`, else `plan.commitmentMonths`) selects the single longest-qualifying AUTOMATIC discount.
- **"Once per customer per year"** is a rolling 365 days.

### Online checkout: POST `/api/bookings/checkout` (changed)
- **Body:** `{ studioSessionId, promoCode?, giftCardCode?, preview? }`.
- **`preview:true`** → `{ listPriceCents, discount:{code,name,amountCents}|null, giftCard:{appliedCents,remainingAfterCents}|null, totalCents }`.
- **Without preview:**
  - When the total is 0, it returns `{ booked:true, bookingId, url:"/booking/success?booking_id=…" }` with no Stripe call.
  - Otherwise it returns `{ url }` for Stripe Checkout.
- **New errors, all `{error,message}`:**
  - `PROMO_NOT_FOUND` for unknown codes, non-CODE discounts and wrong scope.
  - `PROMO_NOT_APPLICABLE`.
  - The `DISCOUNT_*` codes above.
  - `GIFT_CARD_NOT_FOUND`, `GIFT_CARD_EXPIRED`, `GIFT_CARD_EMPTY`, `GIFT_CARD_CHANGED`.
  - `AMOUNT_TOO_SMALL`.
- The gift card is deducted and the promo code redeemed only once the booking exists: immediately on the free path, otherwise in the webhook. The webhook also gained an idempotency guard on `stripePaymentIntentId`. Before that, a retried webhook double-booked.

### Admin APIs
- **`GET /api/admin/discount-codes`** → `{ discounts, options: { sessionTypes, products, locations } }`.
- **`POST /api/admin/discount-codes`** and **`PATCH /api/admin/discount-codes/[id]`:** PATCH takes every field plus `archived: boolean` and the legacy `{active}`. `DELETE` archives.
- **Products:**
  - `GET` adds `effectiveTaxCode`.
  - `PATCH` takes all the new fields plus `archived`.
  - `slug` is never writable.
  - `DELETE` archives.
  - An unpriced or archived product cannot be activated (400).
