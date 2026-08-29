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

const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mutable holder so a 401 partway through the export can swap in a fresh
// token without every call site needing to know about the refresh.
type Auth = { token: string };

async function apiGet<T>(
  auth: Auth,
  urlPath: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(API_BASE + urlPath);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (res.ok) return res.json() as Promise<T>;

    const bodyText = (await res.text()).slice(0, 500);

    if (res.status === 401 && attempt < MAX_RETRIES) {
      console.warn(`GET ${urlPath} got 401 (token expired), refreshing token...`);
      auth.token = await getAccessToken();
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      const delayMs = 1000 * 2 ** attempt;
      console.warn(
        `GET ${urlPath} got ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`
      );
      await sleep(delayMs);
      continue;
    }

    throw new Error(`GET ${urlPath} failed: ${res.status} ${bodyText}`);
  }
}

type Paginated<T> = {
  payload: T[];
  pagination: { page: number; pageSize: number; totalCount: number };
};

async function fetchAllPages<T>(
  auth: Auth,
  urlPath: string,
  extraParams: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 0;

  while (true) {
    const data = await apiGet<Paginated<T>>(auth, urlPath, {
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

function readJsonIfExists<T>(name: string): T | undefined {
  const filePath = path.join(OUT_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  console.log(`Using existing ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

// For the two per-item loops (thousands of sequential requests each), write
// a checkpoint to disk periodically so a mid-run crash (expired token, a
// stretch of 502s) only costs the items fetched since the last checkpoint,
// not the whole loop. Re-running the script picks up where it left off.
async function fetchPerItemMap<T>(
  auth: Auth,
  name: string,
  items: { id: number }[],
  urlPath: (id: number) => string,
  extraParams: Record<string, string | number | boolean | undefined> = {}
): Promise<Record<number, T[]>> {
  const results = readJsonIfExists<Record<number, T[]>>(name) ?? {};
  const alreadyDone = Object.keys(results).length;
  if (alreadyDone > 0) {
    console.log(`Resuming ${name}: ${alreadyDone}/${items.length} already fetched`);
  }

  let sinceCheckpoint = 0;
  for (const item of items) {
    if (results[item.id]) continue;
    results[item.id] = await fetchAllPages<T>(auth, urlPath(item.id), extraParams);
    sinceCheckpoint += 1;
    if (sinceCheckpoint >= 200) {
      writeJson(name, results);
      sinceCheckpoint = 0;
    }
  }
  writeJson(name, results);
  return results;
}

async function main() {
  console.log("Authenticating with Momence...");
  const auth: Auth = { token: await getAccessToken() };

  let members = readJsonIfExists<{ id: number }[]>("members");
  if (!members) {
    console.log("Fetching members...");
    members = await fetchAllPages<{ id: number }>(auth, "/api/v2/host/members");
    writeJson("members", members);
  }

  let sessions = readJsonIfExists<{ id: number }[]>("sessions");
  if (!sessions) {
    console.log("Fetching sessions...");
    sessions = await fetchAllPages<{ id: number }>(auth, "/api/v2/host/sessions", {
      includeCancelled: true,
    });
    writeJson("sessions", sessions);
  }

  console.log(`Fetching bookings for ${sessions.length} sessions...`);
  await fetchPerItemMap(
    auth,
    "session-bookings",
    sessions,
    (id) => `/api/v2/host/sessions/${id}/bookings`
  );

  let appointments = readJsonIfExists<unknown[]>("appointments");
  if (!appointments) {
    console.log("Fetching appointment reservations...");
    appointments = await fetchAllPages(
      auth,
      "/api/v2/host/appointments/reservations",
      { includeCancelled: true, includeCancelledAttendees: true }
    );
    writeJson("appointments", appointments);
  }

  console.log(`Fetching active bought memberships for ${members.length} members...`);
  await fetchPerItemMap(
    auth,
    "bought-memberships",
    members,
    (id) => `/api/v2/host/members/${id}/bought-memberships/active`,
    { includeFrozen: true }
  );

  console.log("Fetching sales...");
  try {
    const sales = await fetchAllPages(auth, "/api/v2/host/sales");
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
