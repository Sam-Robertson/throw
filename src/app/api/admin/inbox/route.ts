import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  forbiddenResponse,
  locationWhereOrUnassigned,
  resolveLocationScope,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guard = await requireStaffScope(searchParams.get("locationId"));
  if (guard.error) return guard.error;

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
      // Conversations from an SMS number not mapped to a studio (locationId
      // null) stay visible to every studio.
      ...locationWhereOrUnassigned(guard.scope),
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
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = (await req.json()) as {
    userId: string;
    messageBody: string;
    locationId?: string;
  };

  if (!body.userId || !body.messageBody)
    return NextResponse.json({ error: "userId, messageBody required" }, { status: 400 });

  // Tag the conversation with the studio it's started from: the one asked
  // for (if the user may use it), else the user's only studio, else none.
  let locationId: string | null = null;
  if (body.locationId) {
    try {
      resolveLocationScope(guard.session, body.locationId);
    } catch (err) {
      return forbiddenResponse(err);
    }
    locationId = body.locationId;
  } else if (guard.scope.locationIds?.length === 1) {
    locationId = guard.scope.locationIds[0];
  }

  const now = new Date();

  const conversation = await prisma.conversation.create({
    data: {
      userId: body.userId,
      locationId,
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
