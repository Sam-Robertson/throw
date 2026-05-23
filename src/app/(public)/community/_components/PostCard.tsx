"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { LikeButton } from "./LikeButton";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

interface Post {
  id: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  isPublished: boolean;
  author: { name: string | null; role: Role };
  _count: { likes: number; comments: number };
  hasLiked: boolean;
}

interface Props {
  post: Post;
  isAuthenticated: boolean;
  truncate?: boolean;
}

const ROLE_LABELS: Record<Role, string | null> = {
  ADMIN: "Owner",
  STAFF: "Staff",
  CUSTOMER: null,
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TRUNCATE_LENGTH = 300;

export function PostCard({ post, isAuthenticated, truncate = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const shouldTruncate = truncate && post.body.length > TRUNCATE_LENGTH;
  const displayBody =
    shouldTruncate && !expanded
      ? post.body.slice(0, TRUNCATE_LENGTH) + "…"
      : post.body;

  const roleLabel = ROLE_LABELS[post.author.role];

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      {/* Author row */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {getInitials(post.author.name)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {post.author.name ?? "Unknown"}
            </span>
            {roleLabel && (
              <Badge variant="secondary" className="text-xs">
                {roleLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
        {!post.isPublished && (
          <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
            Draft
          </Badge>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h2 className="mb-2 text-lg font-bold leading-snug">{post.title}</h2>
      )}

      {/* Body */}
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        {displayBody}
      </p>
      {shouldTruncate && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-sm font-medium underline hover:text-foreground"
        >
          Read more
        </button>
      )}

      {/* Image */}
      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt=""
            className="w-full object-cover"
            style={{ maxHeight: 400 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-4">
        <LikeButton
          postId={post.id}
          initialLiked={post.hasLiked}
          initialCount={post._count.likes}
          disabled={!isAuthenticated}
        />
        <Link
          href={`/community/${post.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post._count.comments}</span>
        </Link>
        <Link
          href={`/community/${post.id}`}
          className="ml-auto text-sm text-muted-foreground underline hover:text-foreground"
        >
          View post
        </Link>
      </div>
    </div>
  );
}
