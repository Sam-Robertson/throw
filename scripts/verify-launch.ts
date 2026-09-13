/**
 * Launch verification against a locally running app (`next start` / `next dev`).
 *
 *   BASE_URL=http://localhost:3100 npx ts-node … scripts/verify-launch.ts
 *
 * Checks:
 *   1. New API routes return 401 when unauthenticated.
 *   2. A STAFF user assigned only to Lehi gets 403 for Provo's sessions
 *      (/api/admin/studio-sessions?locationId=<provo>), 200 for Lehi's, and an
 *      unfiltered request returns no Provo sessions.
 *
 * Creates its own STAFF user + Lehi assignment and deletes them afterwards.
 * Refuses to run unless the database is a local throw_launch_* database.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const TEST_EMAIL = "verify-launch-staff@example.com";
const TEST_PASSWORD = "verify-launch-pass-123";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

class CookieJar {
  private cookies = new Map<string, string>();
  store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signIn(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  jar.store(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header() },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE_URL}/staff` }),
  });
  jar.store(res);
  return jar;
}

async function main() {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`select current_database() as db`;
  if (!db.startsWith("throw_launch")) {
    throw new Error(`Refusing to run against database "${db}" — local throw_launch_* only.`);
  }

  const locations = await prisma.location.findMany({ where: { isActive: true } });
  const lehi = locations.find((l) => l.city === "Lehi");
  const provo = locations.find((l) => l.city === "Provo");
  if (!lehi || !provo) throw new Error("Need an active Lehi and Provo location with city set.");

  // 1. Unauthenticated access to new routes.
  const unauthenticated: Array<[string, string]> = [
    ["GET", "/api/admin/studio-sessions"],
    ["POST", "/api/admin/studio-sessions"],
    ["GET", "/api/admin/pieces"],
    ["GET", "/api/pieces"],
    ["POST", "/api/pieces"],
    ["POST", "/api/upload"],
  ];
  for (const [method, path] of unauthenticated) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : "{}",
      redirect: "manual",
    });
    check(`${method} ${path} unauthenticated -> 401`, res.status === 401, `got ${res.status}`);
  }

  // 2. Lehi-only STAFF user.
  const staffRole =
    (await prisma.staffRole.findFirst({ where: { locationId: lehi.id } })) ??
    (await prisma.staffRole.create({
      data: { locationId: lehi.id, name: "verify-launch role", permissions: { canManageSchedule: true } },
    }));
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { role: "STAFF", hashedPassword: await bcrypt.hash(TEST_PASSWORD, 10) },
    create: {
      email: TEST_EMAIL,
      name: "Verify Launch Staff",
      role: "STAFF",
      hashedPassword: await bcrypt.hash(TEST_PASSWORD, 10),
    },
  });
  await prisma.staffRoleAssignment.upsert({
    where: { userId_locationId: { userId: user.id, locationId: lehi.id } },
    update: { staffRoleId: staffRole.id },
    create: { userId: user.id, locationId: lehi.id, staffRoleId: staffRole.id },
  });

  try {
    const jar = await signIn(TEST_EMAIL, TEST_PASSWORD);
    const get = (path: string) => fetch(`${BASE_URL}${path}`, { headers: { Cookie: jar.header() } });

    const provoRes = await get(`/api/admin/studio-sessions?locationId=${provo.id}`);
    check("Lehi-only STAFF requesting Provo sessions -> 403", provoRes.status === 403, `got ${provoRes.status}`);

    const lehiRes = await get(`/api/admin/studio-sessions?locationId=${lehi.id}`);
    check("Lehi-only STAFF requesting Lehi sessions -> 200", lehiRes.status === 200, `got ${lehiRes.status}`);

    const allRes = await get(`/api/admin/studio-sessions`);
    const body: unknown = await allRes.json().catch(() => null);
    const rows = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { sessions?: unknown }).sessions)
        ? (body as { sessions: unknown[] }).sessions
        : null;
    const leaked =
      rows?.filter((r) => {
        const loc = (r as { locationId?: string | null; location?: { id?: string } | null });
        return (loc.locationId ?? loc.location?.id) === provo.id;
      }).length ?? -1;
    check("Lehi-only STAFF unfiltered sessions contain no Provo rows", allRes.status === 200 && leaked === 0, `status ${allRes.status}, provo rows ${leaked}`);
  } finally {
    await prisma.staffRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    if (staffRole.name === "verify-launch role") {
      await prisma.staffRole.delete({ where: { id: staffRole.id } });
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
