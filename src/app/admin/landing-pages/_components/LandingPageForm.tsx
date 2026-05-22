"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const SLUG_RE = /^[a-z0-9-]+$/;

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface LandingPageFormValues {
  title: string;
  slug: string;
  headline: string;
  subheadline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl: string;
  isActive: boolean;
}

interface Props {
  initialValues?: Partial<LandingPageFormValues>;
  onSubmit: (values: LandingPageFormValues) => Promise<void>;
  saving: boolean;
  error: string | null;
  savedSlug?: string;
}

export function LandingPageForm({
  initialValues,
  onSubmit,
  saving,
  error,
  savedSlug,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initialValues?.slug);
  const [headline, setHeadline] = useState(initialValues?.headline ?? "");
  const [subheadline, setSubheadline] = useState(initialValues?.subheadline ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialValues?.bodyHtml ?? "");
  const [ctaLabel, setCtaLabel] = useState(initialValues?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(initialValues?.ctaUrl ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(initialValues?.heroImageUrl ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);

  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  const slugValid = !slug || SLUG_RE.test(slug);
  const canSave = !!title && !!slug && slugValid && !!headline && !!ctaLabel && !!ctaUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    await onSubmit({ title, slug, headline, subheadline, bodyHtml, ctaLabel, ctaUrl, heroImageUrl, isActive });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lp-title">Title *</Label>
          <Input
            id="lp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer Pottery Camp"
            required
          />
          <p className="text-xs text-muted-foreground">Shown in the browser tab.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lp-slug">Slug *</Label>
          <Input
            id="lp-slug"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
            placeholder="summer-pottery-camp"
            required
          />
          {slug && !slugValid && (
            <p className="text-xs text-destructive">
              Only lowercase letters, numbers, and hyphens.
            </p>
          )}
          {slug && slugValid && (
            <p className="font-mono text-xs text-muted-foreground">/lp/{slug}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lp-headline">Headline *</Label>
        <Input
          id="lp-headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Learn to throw pottery this summer"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lp-subheadline">Subheadline</Label>
        <Input
          id="lp-subheadline"
          value={subheadline}
          onChange={(e) => setSubheadline(e.target.value)}
          placeholder="Optional tagline or supporting text"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lp-hero">Hero image URL</Label>
        <Input
          id="lp-hero"
          value={heroImageUrl}
          onChange={(e) => setHeroImageUrl(e.target.value)}
          placeholder="https://… (optional)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lp-body">Body HTML (optional)</Label>
        <Textarea
          id="lp-body"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={8}
          placeholder="<p>Your content here…</p>"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Basic HTML is supported: &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a&gt;, etc.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lp-cta-label">CTA button label *</Label>
          <Input
            id="lp-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Book a class"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lp-cta-url">CTA button URL *</Label>
          <Input
            id="lp-cta-url"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="/schedule"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="lp-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="lp-active" className="cursor-pointer">
          Active (visible to visitors)
        </Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving || !canSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedSlug && (
          <a
            href={`/lp/${savedSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4"
          >
            Preview ↗
          </a>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/landing-pages")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
