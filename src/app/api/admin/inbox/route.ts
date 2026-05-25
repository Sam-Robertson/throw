import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  // segment: "customers" | "leads" | "instructors" | "plan:{slug}"
  const segment = searchParams.get("segment") ?? "customers";
  const q = searchParams.get("q")?.trim() ?? "";

  // Build user-level filter based on segment
  let userWhere: Prisma.UserWhereInput = {};
  if (segment === "customers") {
    userWhere = { role: "CUSTOMER" };
  } else if (segment === "leads") {
    // Leads = customers with no active membership
    userWhere = {
      role: "CUSTOMER",
      memberships: { none: { status: "ACTIVE" } },
    };
  } else if (segment === "instructors") {
    userWhere = { role: { in: ["STAFF", "ADMIN"] } };
  } else if (segment.startsWith("plan:")) {
    const planSlug = segment.slice(5);
    userWhere = {
      memberships: { some: { status: "ACTIVE", plan: { slug: planSlug } } },
    };
  }

  // Merge with search
  const searchFilter: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const conversations = await prisma.conversation.findMany({
    where: {
      channel: "sms", // inbox is SMS-only
      user: { AND: [userWhere, searchFilter] },
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, direction: true, createdAt: true, isRead: true },
      },
    },
  });

  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    userId: string;
    messageBody: string;
  };

  if (!body.userId || !body.messageBody)
    return NextResponse.json({ error: "userId, messageBody required" }, { status: 400 });

  const now = new Date();

  const conversation = await prisma.conversation.create({
    data: {
      userId: body.userId,
      channel: "sms",
      lastMessageAt: now,
      messages: {
        create: {
          direction: "outbound",
          body: body.messageBody,
          isRead: true,
          createdAt: now,
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}
