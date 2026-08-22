// Export of Momence's catalog data (events, videos, memberships, products,
// teachers) via their public plugin/widget API. This is a static token, not
// OAuth2 — separate and much more limited than scripts/momence-export.ts,
// which pulls members/bookings/sales via the Host Management API.
//
// Run with:
//   npm run momence:export:catalog
//
// Requires MOMENCE_HOST_ID and MOMENCE_WIDGET_TOKEN in .env.local.
import fs from "fs";
import path from "path";

const API_BASE = "https://momence.com/_api/primary/api/v1";
const OUT_DIR = path.join(__dirname, "..", "momence-export");

const ENDPOINTS = ["Events", "Videos", "Memberships", "Products", "Teachers"] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function writeJson(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${filePath}`);
}

async function main() {
  const hostId = requireEnv("MOMENCE_HOST_ID");
  const token = requireEnv("MOMENCE_WIDGET_TOKEN");

  for (const endpoint of ENDPOINTS) {
    console.log(`Fetching ${endpoint}...`);
    const url = new URL(`${API_BASE}/${endpoint}`);
    url.searchParams.set("hostId", hostId);
    url.searchParams.set("token", token);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GET ${endpoint} failed: ${res.status} ${await res.text()}`);
    }

    writeJson(`catalog-${endpoint.toLowerCase()}`, await res.json());
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
