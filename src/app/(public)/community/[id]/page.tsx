import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PostCard } from "../_components/PostCard";
import { CommentsSection } from "../_components/CommentsSection";
import { richTextToPlain } from "@/lib/richText";
import { BackLink } from "@/components/shared/BackLink";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: { title: true, body: true },
  });
  if (!post) return { title: "Post not found — Throw" };
  return {
    title: `${post.title ?? richTextToPlain(post.body).slice(0, 50)} — Community — Throw`,
  };
}

export default async function CommunityPostPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const isAuthenticated = !!userId;
  const isStaffOrAdmin = role === "ADMIN" || role === "STAFF";

  const post = await prisma.communityPost.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, role: true } },
      comments: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) notFound();
  if (!post.isPublished && !isStaffOrAdmin) notFound();

  let hasLiked = false;
  if (userId) {
    const like = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });
    hasLiked = !!like;
  }

  const postForCard = {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    hasLiked,
  };

  const commentsForSection = post.comments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Back link */}
      <BackLink href="/community">Community</BackLink>

      {/* Post card — no truncation */}
      <PostCard post={postForCard} isAuthenticated={isAuthenticated} truncate={false} />

      {/* Comments */}
      <div className="mt-8">
        <CommentsSection
          postId={id}
          initialComments={commentsForSection}
          currentUserId={userId}
          currentUserRole={role}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
