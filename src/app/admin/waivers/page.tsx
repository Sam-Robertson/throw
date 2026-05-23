"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WaiverVersion {
  id: string;
  version: number;
  publishedAt: string;
  isActive: boolean;
  content: string;
  locationId: string | null;
  _count: { signatures: number };
}

interface Location {
  id: string;
  name: string;
}

interface WaiverSignature {
  id: string;
  signedAt: string;
  typedName: string | null;
  signatureImageData: string | null;
  user: { name: string | null; email: string };
}

export default function AdminWaiversPage() {
  const [versions, setVersions] = useState<WaiverVersion[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // New version dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [content, setContent] = useState("");
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signatures dialog
  const [sigsOpen, setSigsOpen] = useState(false);
  const [sigsLoading, setSigsLoading] = useState(false);
  const [signatures, setSignatures] = useState<WaiverSignature[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WaiverVersion | null>(null);

  // Expanded signature image dialog
  const [expandedSig, setExpandedSig] = useState<string | null>(null);

  async function load() {
    const [versionsRes, locationsRes] = await Promise.all([
      fetch("/api/admin/waivers"),
      fetch("/api/admin/locations"),
    ]);
    if (versionsRes.ok) setVersions(await versionsRes.json());
    if (locationsRes.ok) {
      const locs: Location[] = await locationsRes.json();
      setLocations(locs);
      if (locs.length > 0) setLocationId(locs[0].id);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setContent("");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, locationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Something went wrong");
        return;
      }
      setDialogOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function openSignatures(version: WaiverVersion) {
    setSelectedVersion(version);
    setSigsOpen(true);
    setSigsLoading(true);
    setSignatures([]);
    const res = await fetch(`/api/admin/waivers/${version.id}/signatures`);
    if (res.ok) setSignatures(await res.json());
    setSigsLoading(false);
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <TooltipProvider>
      <main className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Waivers</h1>
          <Button onClick={openNew}>New Version</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="text-right">Signatures</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">v{v.version}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(v.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "default" : "secondary"}>
                    {v.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="line-clamp-2">
                    {v.content.slice(0, 100)}
                    {v.content.length > 100 ? "…" : ""}
                  </span>
                </TableCell>
                <TableCell className="text-right">{v._count.signatures}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSignatures(v)}
                    >
                      Signatures
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button size="sm" variant="outline" disabled>
                            Edit
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Published waivers cannot be edited</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {versions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No waiver versions published yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* New version dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Publish New Waiver Version</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {locations.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="location">
                    Location
                  </label>
                  <select
                    id="location"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="content">
                  Waiver content
                </label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={16}
                  placeholder="Enter the full waiver text…"
                  required
                  className="font-mono text-xs"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Publishing this version will deactivate the current active waiver for this
                location. All existing signatures remain valid. Users who have not yet
                signed will be required to sign this new version before booking.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !content.trim()}>
                  {submitting ? "Publishing…" : "Publish"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Signatures dialog */}
        <Dialog open={sigsOpen} onOpenChange={setSigsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Signatures — v{selectedVersion?.version}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({signatures.length})
                </span>
              </DialogTitle>
            </DialogHeader>

            {sigsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : signatures.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No signatures yet.
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Signed as</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signatures.map((sig) => (
                      <TableRow key={sig.id}>
                        <TableCell>
                          <p className="font-medium">{sig.user.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {sig.user.email}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sig.typedName ? (
                            sig.typedName
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sig.signatureImageData ? (
                            <button
                              onClick={() => setExpandedSig(sig.signatureImageData)}
                              className="block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sig.signatureImageData}
                                alt="Signature"
                                style={{ height: 40 }}
                                className="rounded border bg-white object-contain"
                              />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Legacy signature
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(sig.signedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSigsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full-size signature image dialog */}
        <Dialog open={!!expandedSig} onOpenChange={() => setExpandedSig(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Signature</DialogTitle>
            </DialogHeader>
            {expandedSig && (
              <div className="flex items-center justify-center rounded-lg border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={expandedSig}
                  alt="Full signature"
                  className="max-w-full object-contain"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setExpandedSig(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  );
}
