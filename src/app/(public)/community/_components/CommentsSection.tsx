"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CommentForm } from "./CommentForm";
import { Trash2 } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { name: string | null; role: string };
}

interface Props {
  postId: string;
  initialComments: Comment[];
  currentUserId?: string;
  currentUserRole?: string;
  isAuthenticated: boolean;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CommentsSection({
  postId,
  initialComments,
  currentUserId,
  currentUserRole,
  isAuthenticated,
}: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);

  function handleComment(comment: Comment) {
    setComments((prev) => [...prev, comment]);
  }

  async function handleDelete(commentId: string) {
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert("Failed to delete comment.");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Comments ({comments.length})
      </h2>

      {comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => {
            const canDelete =
              currentUserRole === "ADMIN" || comment.authorId === currentUserId;
            return (
              <div key={comment.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {getInitials(comment.author.name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {comment.author.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {comment.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first!
        </p>
      )}

      {isAuthenticated ? (
        <CommentForm postId={postId} onComment={handleComment} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <a href="/login" className="underline hover:text-foreground">
            Sign in
          </a>{" "}
          to comment.
        </p>
      )}
    </div>
  );
}
