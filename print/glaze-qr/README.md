# Glazing-area poster QR code

Encodes `https://www.throwartstudios.app/glaze` (error correction H, so a
poster that gets a bit scuffed still scans). Print the URL as text under the
code as a fallback.

- `glaze-qr-sage.svg` / `.png` — the site's sage (#758C69); the SVG has a transparent background
- `glaze-qr-black.svg` / `.png` — black, for anything that prints in one colour

Where `/glaze` sends people is set by the `GLAZE_QR_DESTINATION` environment
variable on Vercel (see `src/app/glaze/route.ts`): the old site's checkout
during stage 1, this site's `/pay` page when unset (stage 2), the .com site
after the migration (stage 3). Change it, then `vercel --prod`.
