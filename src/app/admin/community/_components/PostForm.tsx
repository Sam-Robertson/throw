"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PostFormData {
  title: string;
  body: string;
  imageUrl: string;
  isPublished: boolean;
}

interface Props {
  postId?: string;
  initialData?: Partial<PostFormData>;
  mode: "new" | "edit";
}

export function PostForm({ postId, initialData, mode }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [body, setBody] = useState(initialData?.body ?? "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? "");
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? true);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(publishedOverride?: boolean) {
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }
    setLoading(true);
    setError("");

    const published = publishedOverride ?? isPublished;
    const payload = {
      title: title.trim() || null,
      body: body.trim(),
      imageUrl: imageUrl.trim() || null,
      isPublished: published,
    };

    try {
      const url =
        mode === "edit"
          ? `/api/community/posts/${postId}`
          : "/api/community/posts";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }

      router.push("/admin/community");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!postId) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/community/posts/${postId}`, { method: "DELETE" });
    router.push("/admin/community");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title..."
          disabled={loading}
        />
      </div>

      {/* Body */}
      <div className="space-y-2">
        <Label htmlFor="body">
          Body <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          rows={8}
          disabled={loading}
          className="min-h-[160px]"
        />
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <Label htmlFor="imageUrl">Image URL (optional)</Label>
        <Input
          id="imageUrl"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setImageError(false);
          }}
          placeholder="https://..."
          disabled={loading}
        />
        {imageUrl && !imageError && (
          <div className="overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full object-cover"
              style={{ maxHeight: 300 }}
              onError={() => setImageError(true)}
            />
          </div>
        )}
        {imageUrl && imageError && (
          <p className="text-xs text-muted-foreground">
            Invalid image URL — preview unavailable.
          </p>
        )}
      </div>

      {/* Published toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="isPublished"
          checked={isPublished}
          onCheckedChange={setIsPublished}
          disabled={loading}
        />
        <Label htmlFor="isPublished">Published</Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {mode === "new" ? (
          <>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={loading || !body.trim()}
            >
              Publish Post
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={loading || !body.trim()}
            >
              Save Draft
            </Button>
          </>
        ) : (
          <Button onClick={() => handleSubmit()} disabled={loading || !body.trim()}>
            Save Changes
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push("/admin/community")}
          disabled={loading}
        >
          Cancel
        </Button>

        {mode === "edit" && (
          <Button
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            Delete Post
          </Button>
        )}
      </div>
    </div>
  );
}
