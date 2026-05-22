"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingPageForm, type LandingPageFormValues } from "../_components/LandingPageForm";

export default function NewLandingPagePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: LandingPageFormValues) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/landing-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      const created = await res.json() as { id: string };
      router.push(`/admin/landing-pages/${created.id}/edit`);
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/admin/landing-pages"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Landing Pages
        </Link>
        <h1 className="text-xl font-semibold">New Landing Page</h1>
      </div>
      <LandingPageForm onSubmit={handleSubmit} saving={saving} error={error} />
    </div>
  );
}
