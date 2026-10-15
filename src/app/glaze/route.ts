import { NextResponse } from "next/server";

/**
 * The URL printed on the glazing-area posters: https://www.throwartstudios.app/glaze
 *
 * The posters never change; where this sends people does, by stage:
 *   1. the old website's clay & glaze checkout (GLAZE_QR_DESTINATION set to it)
 *   2. this site's public pay page (GLAZE_QR_DESTINATION unset → /pay)
 *   3. the .com site once the migration is done (GLAZE_QR_DESTINATION set to it)
 *
 * Always a temporary redirect: phones and browsers cache a permanent one, and
 * someone who scanned during stage 1 would keep landing on the old checkout
 * after the switch. Changing GLAZE_QR_DESTINATION on Vercel takes effect on
 * the next deploy (`vercel --prod`).
 */
export const dynamic = "force-dynamic";

const DEFAULT_DESTINATION = "/pay";

export function GET(request: Request) {
  const configured = process.env.GLAZE_QR_DESTINATION?.trim();
  const destination = configured && /^(https?:\/\/|\/)/.test(configured) ? configured : DEFAULT_DESTINATION;
  const target = new URL(destination, request.url);
  return NextResponse.redirect(target, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}
