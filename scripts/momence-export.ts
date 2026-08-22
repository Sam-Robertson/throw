// One-time export of all data from JP's Momence account via their public API.
// Run with:
//   npm run momence:export
//
// Requires MOMENCE_CLIENT_ID, MOMENCE_CLIENT_SECRET, MOMENCE_USERNAME,
// MOMENCE_PASSWORD in .env.local. Writes JSON files to momence-export/
// (gitignored) for review before any of it gets mapped into our schema.
import fs from "fs";
import path from "path";

const API_BASE = "https://api.momence.com";
const PAGE_SIZE = 100;
const OUT_DIR = path.join(__dirname, "..", "momence-export");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  accessTokenExpiresAt: string;
};

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("MOMENCE_CLIENT_ID");
  const clientSecret = requireEnv("MOMENCE_CLIENT_SECRET");
  const username = requireEnv("MOMENCE_USERNAME");
  const password = requireEnv("MOMENCE_PASSWORD");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${API_BASE}/api/v2/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

async function apiGet<T>(
  token: string,
  urlPath: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(API_BASE + urlPath);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`GET ${urlPath} failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

type Paginated<T> = {
  payload: T[];
  pagination: { page: number; pageSize: number; totalCount: number };
};

async function fetchAllPages<T>(
  token: string,
  urlPath: string,
  extraParams: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 0;

  while (true) {
    const data = await apiGet<Paginated<T>>(token, urlPath, {
      ...extraParams,
      page,
      pageSize: PAGE_SIZE,
    });
    results.push(...data.payload);

    const { totalCount } = data.pagination;
    page += 1;
    if (page * PAGE_SIZE >= totalCount || data.payload.length === 0) break;
  }

  return results;
}

function writeJson(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${filePath}`);
}

async function main() {
  console.log("Authenticating with Momence...");
  const token = await getAccessToken();

  console.log("Fetching members...");
  const members = await fetchAllPages<{ id: number }>(token, "/api/v2/host/members");
  writeJson("members", members);

  console.log("Fetching sessions...");
  const sessions = await fetchAllPages<{ id: number }>(token, "/api/v2/host/sessions", {
    includeCancelled: true,
  });
  writeJson("sessions", sessions);

  console.log(`Fetching bookings for ${sessions.length} sessions...`);
  const sessionBookings: Record<number, unknown[]> = {};
  for (const session of sessions) {
    sessionBookings[session.id] = await fetchAllPages(
      token,
      `/api/v2/host/sessions/${session.id}/bookings`
    );
  }
  writeJson("session-bookings", sessionBookings);

  console.log("Fetching appointment reservations...");
  const appointments = await fetchAllPages(
    token,
    "/api/v2/host/appointments/reservations",
    { includeCancelled: true, includeCancelledAttendees: true }
  );
  writeJson("appointments", appointments);

  console.log(`Fetching active bought memberships for ${members.length} members...`);
  const boughtMemberships: Record<number, unknown[]> = {};
  for (const member of members) {
    boughtMemberships[member.id] = await fetchAllPages(
      token,
      `/api/v2/host/members/${member.id}/bought-memberships/active`,
      { includeFrozen: true }
    );
  }
  writeJson("bought-memberships", boughtMemberships);

  console.log("Fetching sales...");
  try {
    const sales = await fetchAllPages(token, "/api/v2/host/sales");
    writeJson("sales", sales);
  } catch (err) {
    console.warn(
      "Sales endpoint failed (it's marked experimental by Momence, may need to be enabled by their support):",
      err
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
