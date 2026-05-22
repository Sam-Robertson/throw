"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMountainTime } from "@/lib/timezone";

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  isActive: boolean;
  updatedAt: string;
}

export default function AdminLandingPagesPage() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/landing-pages");
    if (res.ok) setPages(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(id: string) {
    await fetch(`/api/admin/landing-pages/${id}/toggle`, { method: "PATCH" });
    await load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Landing Pages</h1>
        <Link href="/admin/landing-pages/new">
          <Button size="sm">New Page</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No landing pages yet.{" "}
          <Link
            href="/admin/landing-pages/new"
            className="underline underline-offset-4"
          >
            Create one.
          </Link>
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Slug</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{page.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    /lp/{page.slug}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={page.isActive ? "default" : "secondary"}>
                      {page.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatMountainTime(new Date(page.updatedAt), "date")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/lp/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground underline underline-offset-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Preview
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/admin/landing-pages/${page.id}/edit`)
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(page.id)}
                        className="text-xs"
                      >
                        {page.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
