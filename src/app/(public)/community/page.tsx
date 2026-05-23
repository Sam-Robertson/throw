import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { FeedClient } from "./_components/FeedClient";

export const metadata = {
  title: "Community — Throw",
};

export default async function CommunityPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const isAuthenticated = !!userId;
  const isStaffOrAdmin = role === "ADMIN" || role === "STAFF";

  const where = isStaffOrAdmin ? {} : { isPublished: true };

  const posts = await prisma.communityPost.findMany({
    where,
    include: {
      author: { select: { name: true, role: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  let likedPostIds = new Set<string>();
  if (userId) {
    const likes = await prisma.communityLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const postsWithLiked = posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    hasLiked: likedPostIds.has(post.id),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community</h1>
        {isStaffOrAdmin && (
          <Button asChild>
            <Link href="/admin/community/new">New Post</Link>
          </Button>
        )}
      </div>

      {/* Auth banner */}
      {!isAuthenticated && (
        <div className="mb-6 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Sign in to like and comment.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      )}

      {/* Feed */}
      {postsWithLiked.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No posts yet. Check back soon!
        </p>
      ) : (
        <FeedClient
          initialPosts={postsWithLiked}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
