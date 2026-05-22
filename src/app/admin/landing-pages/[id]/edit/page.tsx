"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LandingPageForm,
  type LandingPageFormValues,
} from "../../_components/LandingPageForm";

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string | null;
  bodyHtml: string | null;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl: string | null;
  isActive: boolean;
}

export default function EditLandingPagePage() {
  const params = useParams();
  const id = params.id as string;

  const [page, setPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/landing-pages/${id}`);
    if (res.ok) {
      setPage(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: { role?: string } }) => {
        if (data?.user?.role === "ADMIN") setIsAdmin(true);
      });
  }, [load]);

  async function handleSubmit(values: LandingPageFormValues) {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch(`/api/admin/landing-pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      const updated = await res.json() as LandingPage;
      setPage(updated);
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this landing page? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/landing-pages/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      window.location.href = "/admin/landing-pages";
    } else {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!page) {
    return <div className="p-6 text-sm text-destructive">Landing page not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/landing-pages"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            ← Landing Pages
          </Link>
          <h1 className="text-xl font-semibold">Edit Landing Page</h1>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        )}
      </div>

      {success && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
          Saved successfully.{" "}
          <a
            href={`/lp/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Preview ↗
          </a>
        </div>
      )}

      <LandingPageForm
        key={page.id}
        initialValues={{
          title: page.title,
          slug: page.slug,
          headline: page.headline,
          subheadline: page.subheadline ?? "",
          bodyHtml: page.bodyHtml ?? "",
          ctaLabel: page.ctaLabel,
          ctaUrl: page.ctaUrl,
          heroImageUrl: page.heroImageUrl ?? "",
          isActive: page.isActive,
        }}
        onSubmit={handleSubmit}
        saving={saving}
        error={error}
        savedSlug={page.slug}
      />
    </div>
  );
}
