import type { NextConfig } from "next";

process.env.TZ = "UTC";

// The site's one public address. Vercel already sends the bare domain to www.
const CANONICAL_HOST = "www.throwartstudios.app";
// Old hosts that still resolve: send visitors on to the real one. API routes are
// left alone so webhooks registered against an old host (Stripe, Sendblue) keep
// working until they are re-pointed; webhook senders do not follow redirects.
const LEGACY_HOSTS = ["throw-kappa.vercel.app"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  async redirects() {
    return LEGACY_HOSTS.map((host) => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${CANONICAL_HOST}/:path`,
      permanent: true,
    }));
  },
};

export default nextConfig;
