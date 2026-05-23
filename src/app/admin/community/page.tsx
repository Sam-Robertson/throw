"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Post {
  id: string;
  title: string | null;
  body: string;
  isPublished: boolean;
  createdAt: string;
  author: { name: string | null };
  _count: { likes: number; comments: number };
}

export default function AdminCommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/community/posts?limit=50");
    if (res.ok) {
      const data = (await res.json()) as { posts: Post[] };
      setPosts(data.posts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePublished(post: Post) {
    await fetch(`/api/community/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !post.isPublished }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/community/posts/${id}`, { method: "DELETE" });
    setDeletingId(null);
    await load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Community Posts</h1>
        <Button asChild size="sm">
          <Link href="/admin/community/new">New Post</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No posts yet.{" "}
          <Link href="/admin/community/new" className="underline underline-offset-4">
            Create one.
          </Link>
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium">Post</th>
                <th className="px-4 py-2 text-left font-medium">Author</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Likes</th>
                <th className="px-4 py-2 text-left font-medium">Comments</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const preview = post.title ?? post.body.slice(0, 50);
                return (
                  <tr key={post.id} className="border-b last:border-0">
                    <td className="max-w-xs px-4 py-2">
                      <p className="truncate font-medium">{preview}</p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {post.author.name ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={post.isPublished ? "default" : "secondary"}>
                        {post.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {post._count.likes}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {post._count.comments}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(`/admin/community/${post.id}/edit`)
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => togglePublished(post)}
                        >
                          {post.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-destructive hover:text-destructive"
                          disabled={deletingId === post.id}
                          onClick={() => handleDelete(post.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
