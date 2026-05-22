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
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  const [payments, totalCount, totalRevenueResult, refunds, totalRefundedResult] =
    await Promise.all([
      prisma.payment.findMany({
        where: { status: "SUCCEEDED", createdAt: { gte: from, lte: to } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({
        where: { status: "SUCCEEDED", createdAt: { gte: from, lte: to } },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", createdAt: { gte: from, lte: to } },
        _sum: { amountInCents: true },
      }),
      prisma.payment.findMany({
        where: { status: "REFUNDED", createdAt: { gte: from, lte: to } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.aggregate({
        where: { status: "REFUNDED", createdAt: { gte: from, lte: to } },
        _sum: { amountInCents: true },
      }),
    ]);

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      date: p.createdAt,
      type: p.type,
      customerName: p.user.name ?? p.user.email,
      amountInCents: p.amountInCents,
      bookingId: p.bookingId,
      membershipId: p.membershipId,
    })),
    totalRevenue: totalRevenueResult._sum.amountInCents ?? 0,
    totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    refunds: refunds.map((p) => ({
      id: p.id,
      date: p.createdAt,
      type: p.type,
      customerName: p.user.name ?? p.user.email,
      amountInCents: p.amountInCents,
    })),
    totalRefunded: totalRefundedResult._sum.amountInCents ?? 0,
  });
}
