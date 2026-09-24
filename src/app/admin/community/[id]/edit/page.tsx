import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PostForm } from "../../_components/PostForm";
import { BackLink } from "@/components/shared/BackLink";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Edit Post — Admin — Throw",
};

export default async function AdminCommunityEditPage({ params }: Props) {
  const { id } = await params;

  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      imageUrl: true,
      isPublished: true,
    },
  });

  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <BackLink href="/admin/community">Community posts</BackLink>
      <h1 className="mb-6 text-xl font-semibold">Edit Post</h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initialData={{
          title: post.title ?? "",
          body: post.body,
          imageUrl: post.imageUrl ?? "",
          isPublished: post.isPublished,
        }}
      />
    </div>
  );
}
