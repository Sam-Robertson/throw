"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
}

export function LikeButton({ postId, initialLiked, initialCount, disabled }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (disabled || loading) return;
    const prevLiked = liked;
    const prevCount = count;
    // Optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 text-sm transition-colors",
        liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500",
        disabled && "cursor-default opacity-60",
      )}
      aria-label={liked ? "Unlike post" : "Like post"}
    >
      <Heart
        className={cn("h-4 w-4", liked && "fill-current")}
      />
      <span>{count}</span>
    </button>
  );
}
