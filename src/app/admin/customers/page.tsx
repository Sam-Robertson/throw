"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMountainTime } from "@/lib/timezone";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  activeMembership: string | null;
  membershipStatus: string | null;
  upcomingBookingCount: number;
  lastBookingAt: string | null;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("q", search);
    const res = await fetch(`/api/admin/customers?${params}`);
    if (res.ok) {
      const data = await res.json() as {
        customers: Customer[];
        total: number;
      };
      setCustomers(data.customers);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(q);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <Input
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm text-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {search && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setQ(""); setSearch(""); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customers found.</p>
      ) : (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Membership</th>
                  <th className="px-4 py-2 text-right font-medium">Upcoming</th>
                  <th className="px-4 py-2 text-left font-medium">Last Booking</th>
                  <th className="px-4 py-2 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => router.push(`/admin/customers/${c.id}`)}
                  >
                    <td className="px-4 py-2 font-medium">
                      {c.name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-2">
                      {c.activeMembership ? (
                        <Badge
                          variant={
                            c.membershipStatus === "PAUSED"
                              ? "secondary"
                              : "default"
                          }
                          className="text-xs"
                        >
                          {c.activeMembership}
                          {c.membershipStatus === "PAUSED" && " (paused)"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {c.upcomingBookingCount}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {c.lastBookingAt
                        ? formatMountainTime(new Date(c.lastBookingAt), "date")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatMountainTime(new Date(c.createdAt), "date")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
