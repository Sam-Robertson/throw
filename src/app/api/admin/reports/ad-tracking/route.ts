import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const def = defaultRange();
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : def.from;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : def.to;

  const records = await prisma.adTracking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: {
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      firstBookingAt: true,
      firstPurchaseAt: true,
    },
  });

  const total = records.length;
  const attributedBookings = records.filter((r) => r.firstBookingAt !== null).length;
  const attributedPurchases = records.filter((r) => r.firstPurchaseAt !== null).length;
  const conversionRate = total > 0 ? attributedBookings / total : 0;

  // UTM breakdown: group by source + medium + campaign
  const utmMap: Record<
    string,
    {
      source: string | null;
      medium: string | null;
      campaign: string | null;
      sessions: number;
      bookings: number;
      purchases: number;
    }
  > = {};

  for (const r of records) {
    if (r.utmSource === null) continue; // only show rows with a source
    const key = `${r.utmSource ?? ""}||${r.utmMedium ?? ""}||${r.utmCampaign ?? ""}`;
    if (!utmMap[key]) {
      utmMap[key] = {
        source: r.utmSource,
        medium: r.utmMedium,
        campaign: r.utmCampaign,
        sessions: 0,
        bookings: 0,
        purchases: 0,
      };
    }
    utmMap[key].sessions++;
    if (r.firstBookingAt) utmMap[key].bookings++;
    if (r.firstPurchaseAt) utmMap[key].purchases++;
  }

  const utmBreakdown = Object.values(utmMap)
    .map((row) => ({
      ...row,
      conversionRate: row.sessions > 0 ? row.bookings / row.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return NextResponse.json({
    summary: {
      total,
      attributedBookings,
      attributedPurchases,
      conversionRate,
    },
    utmBreakdown,
  });
}
