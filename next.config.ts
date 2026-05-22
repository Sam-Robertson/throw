import type { NextConfig } from "next";

process.env.TZ = "UTC";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
