import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const isStaffOrAdmin = role === "ADMIN" || role === "STAFF";

  const post = await prisma.communityPost.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, role: true } },
      comments: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { likes: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!post.isPublished && !isStaffOrAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let hasLiked = false;
  if (userId) {
    const like = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });
    hasLiked = !!like;
  }

  return NextResponse.json({ ...post, hasLiked });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const post = await prisma.communityPost.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.body !== undefined && { body: body.body }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
    },
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return NextResponse.json(post);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.communityPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
