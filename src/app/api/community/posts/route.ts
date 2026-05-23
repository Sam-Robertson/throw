import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") ?? "10")));
  const skip = (page - 1) * limit;

  const isStaffOrAdmin = role === "ADMIN" || role === "STAFF";
  const where = isStaffOrAdmin ? {} : { isPublished: true };

  const posts = await prisma.communityPost.findMany({
    where,
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  // If authenticated, get hasLiked for each post
  let likedPostIds = new Set<string>();
  if (userId) {
    const likes = await prisma.communityLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const result = posts.map((post) => ({
    ...post,
    hasLiked: likedPostIds.has(post.id),
  }));

  return NextResponse.json({ posts: result, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const post = await prisma.communityPost.create({
    data: {
      authorId: session.user.id,
      title: body.title ?? null,
      body: body.body,
      imageUrl: body.imageUrl ?? null,
      isPublished: body.isPublished ?? true,
    },
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}
