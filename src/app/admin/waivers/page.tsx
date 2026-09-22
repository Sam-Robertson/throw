"use client";

import { useEffect, useState } from "react";
import { RichText } from "@/components/shared/RichText";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { Input } from "@/components/ui/input";
import { shortLocationName } from "@/lib/locationName";
import { isRichTextEmpty, richTextToPlain } from "@/lib/richText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  address: string | null;
}

/** One customer from the signer lookup, with every waiver they have signed. */
interface SignerResult {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  signatures: {
    id: string;
    signedAt: string;
    typedName: string | null;
    source: string;
    signatureImageData: string | null;
    version: number;
    isCurrent: boolean;
    locationId: string;
    locationName: string;
  }[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

  // Full text of one version
  const [viewVersion, setViewVersion] = useState<WaiverVersion | null>(null);

  // Signer lookup across every version
  const [lookup, setLookup] = useState("");
  const [lookupResults, setLookupResults] = useState<SignerResult[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Search inside one version's signature list
  const [sigSearch, setSigSearch] = useState("");

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

  async function loadSignatures(version: WaiverVersion, q: string) {
    setSigsLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/waivers/${version.id}/signatures?${params}`);
    if (res.ok) setSignatures(await res.json());
    setSigsLoading(false);
  }

  async function openSignatures(version: WaiverVersion) {
    setSelectedVersion(version);
    setSigsOpen(true);
    setSignatures([]);
    setSigSearch("");
    await loadSignatures(version, "");
  }

  // Search a version's signers as the desk types (debounced).
  useEffect(() => {
    if (!sigsOpen || !selectedVersion) return;
    const t = setTimeout(() => loadSignatures(selectedVersion, sigSearch), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigSearch]);

  // Look a customer up by name or email across every version.
  useEffect(() => {
    const q = lookup.trim();
    if (q.length < 2) {
      setLookupResults(null);
      return;
    }
    setLookupLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/waivers/lookup?q=${encodeURIComponent(q)}`);
      setLookupResults(res.ok ? await res.json() : []);
      setLookupLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [lookup]);

  const locationLabel = (id: string | null) => {
    const loc = locations.find((l) => l.id === id);
    return loc ? shortLocationName(loc.name, loc.address) : "All studios";
  };
  const currentVersions = versions.filter((v) => v.isActive);

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

        {/* Who has signed? */}
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Has someone signed?</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Search by name or email. Shows every waiver the customer has signed and whether it is
            the one currently in force at that studio.
          </p>
          <Input
            placeholder="Customer name or email…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            className="max-w-md"
          />
          {lookup.trim().length >= 2 && (
            <div className="mt-4">
              {lookupLoading && lookupResults === null ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : lookupResults && lookupResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No customers match.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Waiver</TableHead>
                      <TableHead>Signed</TableHead>
                      <TableHead>Signature</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lookupResults ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="align-top">
                          <p className="font-medium">{u.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                        </TableCell>
                        {u.signatures.length === 0 ? (
                          <TableCell colSpan={3} className="align-top">
                            <Badge variant="destructive">Not signed</Badge>
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="align-top text-sm">
                              {u.signatures.map((sig) => (
                                <div key={sig.id} className="flex items-center gap-2 py-0.5">
                                  <span>
                                    {locationLabel(sig.locationId)} v{sig.version}
                                  </span>
                                  <Badge variant={sig.isCurrent ? "default" : "secondary"}>
                                    {sig.isCurrent ? "Current" : "Old version"}
                                  </Badge>
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              {u.signatures.map((sig) => (
                                <div key={sig.id} className="py-0.5">
                                  {formatDate(sig.signedAt)}
                                  {sig.source === "momence" && " (imported)"}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="align-top">
                              {u.signatures.map((sig) => (
                                <div key={sig.id} className="py-0.5">
                                  {sig.signatureImageData ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedSig(sig.signatureImageData)}
                                      className="block"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={sig.signatureImageData}
                                        alt="Signature"
                                        style={{ height: 28 }}
                                        className="rounded border bg-white object-contain"
                                      />
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {sig.typedName ? `Typed: ${sig.typedName}` : "No image"}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </section>

        {/* The waiver customers sign today, per studio */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Current waiver</h2>
          {currentVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active waiver. Publish one below.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {currentVersions.map((v) => (
                <div key={v.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{locationLabel(v.locationId)}</p>
                      <p className="text-xs text-muted-foreground">
                        v{v.version} · published {formatDate(v.publishedAt)} · {v._count.signatures} signed
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setViewVersion(v)}>
                      Read full text
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-hidden text-sm text-muted-foreground [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                    <RichText value={v.content} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className="mb-3 text-lg font-medium">All versions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Studio</TableHead>
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
                <TableCell className="text-sm">{locationLabel(v.locationId)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(v.publishedAt)}</TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "default" : "secondary"}>
                    {v.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="line-clamp-2">
                    {richTextToPlain(v.content).slice(0, 100)}
                    {richTextToPlain(v.content).length > 100 ? "…" : ""}
                  </span>
                </TableCell>
                <TableCell className="text-right">{v._count.signatures}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewVersion(v)}>
                      Read
                    </Button>
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
                  colSpan={7}
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
                <RichTextEditor
                  id="content"
                  value={content}
                  onChange={setContent}
                  placeholder="Enter the full waiver text…"
                  minHeight={360}
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
                <Button type="submit" disabled={submitting || isRichTextEmpty(content)}>
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

            <Input
              placeholder="Search signers by name or email…"
              value={sigSearch}
              onChange={(e) => setSigSearch(e.target.value)}
            />

            {sigsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : signatures.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {sigSearch.trim() ? "No signers match." : "No signatures yet."}
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
                        <TableCell className="text-sm text-muted-foreground">{formatDate(sig.signedAt)}</TableCell>
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

        {/* Full text of one version */}
        <Dialog open={!!viewVersion} onOpenChange={() => setViewVersion(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {viewVersion && `${locationLabel(viewVersion.locationId)} waiver v${viewVersion.version}`}
                {viewVersion?.isActive && <Badge className="ml-2">Current</Badge>}
              </DialogTitle>
            </DialogHeader>
            {viewVersion && (
              <div className="max-h-[65vh] overflow-y-auto rounded-lg border bg-white p-6">
                <RichText value={viewVersion.content} />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewVersion(null)}>
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
