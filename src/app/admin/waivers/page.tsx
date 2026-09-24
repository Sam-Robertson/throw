"use client";

import { useEffect, useState } from "react";
import { RichText } from "@/components/shared/RichText";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { Input } from "@/components/ui/input";
import { shortLocationName } from "@/lib/locationName";
import { isRichTextEmpty } from "@/lib/richText";
import {
  WAIVER_KINDS,
  WAIVER_KIND_HELP,
  WAIVER_KIND_LABELS,
  WAIVER_KIND_PICKER_LABELS,
  WAIVER_SCOPE_LABELS,
  scopesForKind,
  type WaiverKind,
  type WaiverScope,
} from "@/lib/waiverKinds";
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
  _count: { signatures: number };
}

interface Waiver {
  id: string;
  name: string;
  kind: WaiverKind;
  locationId: string | null;
  appliesTo: WaiverScope;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  location: { id: string; name: string; address: string | null } | null;
  sessionTypes: { sessionType: { id: string; name: string; kind: string } }[];
  plans: { plan: { id: string; name: string } }[];
  versions: WaiverVersion[];
}

/** A class type or membership plan the "applies to" picker can choose. */
interface ScopeOption {
  id: string;
  name: string;
  detail?: string;
  retired: boolean;
}

interface ScopeState {
  appliesTo: WaiverScope;
  sessionTypeIds: string[];
  planIds: string[];
}

const DEFAULT_SCOPE: ScopeState = { appliesTo: "ALL", sessionTypeIds: [], planIds: [] };

interface Location {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
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
    waiverName: string | null;
    kind: WaiverKind;
    isCurrent: boolean;
    locationId: string | null;
    locationName: string | null;
  }[];
}

interface WaiverSignature {
  id: string;
  signedAt: string;
  typedName: string | null;
  signatureImageData: string | null;
  user: { name: string | null; email: string };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function currentVersion(w: Waiver): WaiverVersion | null {
  return w.versions.find((v) => v.isActive) ?? null;
}

function signatureTotal(w: Waiver): number {
  return w.versions.reduce((sum, v) => sum + v._count.signatures, 0);
}

/** "Courses only", or "Only: Kids Camp, Date Night" for a SELECTED waiver. */
function scopeLabel(w: Waiver): string | null {
  if (w.kind === "OTHER") return null;
  if (w.appliesTo === "SELECTED") {
    const names = w.kind === "CLASS" ? w.sessionTypes.map((t) => t.sessionType.name) : w.plans.map((p) => p.plan.name);
    return names.length ? `Only: ${names.join(", ")}` : "Only: nothing chosen";
  }
  return WAIVER_SCOPE_LABELS[w.kind][w.appliesTo] ?? null;
}

/**
 * "Applies to" for a class or membership waiver: a scope select, and a
 * checklist of class types or plans when the scope is "SELECTED".
 */
function ScopePicker({
  idPrefix,
  kind,
  value,
  onChange,
  sessionTypes,
  plans,
}: {
  idPrefix: string;
  kind: WaiverKind;
  value: ScopeState;
  onChange: (next: ScopeState) => void;
  sessionTypes: ScopeOption[];
  plans: ScopeOption[];
}) {
  const [filter, setFilter] = useState("");
  if (kind === "OTHER") return null;
  const scopes = scopesForKind(kind);
  const options = kind === "CLASS" ? sessionTypes : plans;
  const chosen = kind === "CLASS" ? value.sessionTypeIds : value.planIds;
  const setChosen = (ids: string[]) =>
    onChange(kind === "CLASS" ? { ...value, sessionTypeIds: ids } : { ...value, planIds: ids });
  const q = filter.trim().toLowerCase();
  const visible = options.filter(
    (o) => (!o.retired || chosen.includes(o.id)) && (!q || o.name.toLowerCase().includes(q)),
  );
  const noun = kind === "CLASS" ? "class types" : "membership plans";

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={`${idPrefix}-applies`}>Applies to</label>
      <select
        id={`${idPrefix}-applies`}
        value={value.appliesTo}
        onChange={(e) => onChange({ ...value, appliesTo: e.target.value as WaiverScope })}
        className="w-full rounded-md border px-3 py-2 text-sm"
      >
        {scopes.map((sc) => (
          <option key={sc} value={sc}>{WAIVER_SCOPE_LABELS[kind][sc]}</option>
        ))}
      </select>
      {value.appliesTo === "SELECTED" && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${noun}…`}
              className="h-8"
            />
            <span className="shrink-0 text-xs text-muted-foreground">{chosen.length} chosen</span>
          </div>
          <div className="max-h-56 overflow-y-auto p-2">
            {options.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No {noun} yet.</p>
            ) : visible.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Nothing matches.</p>
            ) : (
              visible.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={chosen.includes(o.id)}
                    onChange={(e) =>
                      setChosen(e.target.checked ? [...chosen, o.id] : chosen.filter((id) => id !== o.id))
                    }
                  />
                  <span>{o.name}</span>
                  {o.detail && <span className="text-xs text-muted-foreground">{o.detail}</span>}
                  {o.retired && <span className="text-xs text-muted-foreground">(retired)</span>}
                </label>
              ))
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {kind === "CLASS"
          ? "Customers are asked to sign before booking anything this covers. A studio's class waivers add up: a course booking needs every class waiver at that studio that covers courses."
          : "Customers are asked to sign before starting any plan this covers."}
      </p>
    </div>
  );
}

export default function AdminWaiversPage() {
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessionTypes, setSessionTypes] = useState<ScopeOption[]>([]);
  const [plans, setPlans] = useState<ScopeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // New waiver dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<WaiverKind>("CLASS");
  const [newLocationId, setNewLocationId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newScope, setNewScope] = useState<ScopeState>(DEFAULT_SCOPE);

  // New version of an existing waiver
  const [versionFor, setVersionFor] = useState<Waiver | null>(null);
  const [versionContent, setVersionContent] = useState("");

  // Rename / describe
  const [editFor, setEditFor] = useState<Waiver | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScope, setEditScope] = useState<ScopeState>(DEFAULT_SCOPE);

  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Signatures of one version
  const [sigsFor, setSigsFor] = useState<{ waiver: Waiver; version: WaiverVersion } | null>(null);
  const [sigsLoading, setSigsLoading] = useState(false);
  const [signatures, setSignatures] = useState<WaiverSignature[]>([]);
  const [sigSearch, setSigSearch] = useState("");

  // Expanded signature image dialog
  const [expandedSig, setExpandedSig] = useState<string | null>(null);

  // Full text of one version
  const [viewFor, setViewFor] = useState<{ waiver: Waiver; version: WaiverVersion } | null>(null);

  // Sign link / QR for one waiver
  const [linkFor, setLinkFor] = useState<Waiver | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Signer lookup across every waiver
  const [lookup, setLookup] = useState("");
  const [lookupResults, setLookupResults] = useState<SignerResult[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  async function load() {
    const [waiversRes, locationsRes, typesRes, plansRes] = await Promise.all([
      fetch("/api/admin/waivers"),
      fetch("/api/admin/locations"),
      fetch("/api/admin/session-types"),
      fetch("/api/admin/membership-plans"),
    ]);
    if (waiversRes.ok) setWaivers(await waiversRes.json());
    else setPageError("Could not load waivers.");
    if (locationsRes.ok) setLocations(await locationsRes.json());
    if (typesRes.ok) {
      const rows: { id: string; name: string; kind: string; isActive: boolean; archivedAt: string | null }[] =
        await typesRes.json();
      setSessionTypes(
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          detail: t.kind === "COURSE" ? "course" : undefined,
          retired: !t.isActive || t.archivedAt !== null,
        })),
      );
    }
    if (plansRes.ok) {
      const rows: { id: string; name: string; isActive: boolean; locationId: string | null }[] = await plansRes.json();
      setPlans(rows.map((p) => ({ id: p.id, name: p.name, retired: !p.isActive })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setNewName("");
    setNewKind("CLASS");
    setNewLocationId("");
    setNewDescription("");
    setNewContent("");
    setNewScope(DEFAULT_SCOPE);
    setDialogError(null);
    setNewOpen(true);
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setDialogError(null);
    try {
      const res = await fetch("/api/admin/waivers", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          name: newName,
          kind: newKind,
          locationId: newLocationId || null,
          description: newDescription,
          content: newContent,
          ...newScope,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDialogError((data as { error?: string }).error ?? "Something went wrong");
        return;
      }
      setNewOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function openNewVersion(w: Waiver) {
    setVersionFor(w);
    setVersionContent(currentVersion(w)?.content ?? "");
    setDialogError(null);
  }

  async function submitNewVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionFor) return;
    setSubmitting(true);
    setDialogError(null);
    try {
      const res = await fetch(`/api/admin/waivers/${versionFor.id}/versions`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ content: versionContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDialogError((data as { error?: string }).error ?? "Something went wrong");
        return;
      }
      setVersionFor(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(w: Waiver) {
    setEditFor(w);
    setEditName(w.name);
    setEditDescription(w.description ?? "");
    setEditScope({
      appliesTo: w.appliesTo,
      sessionTypeIds: w.sessionTypes.map((t) => t.sessionType.id),
      planIds: w.plans.map((p) => p.plan.id),
    });
    setDialogError(null);
  }

  async function patchWaiver(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/admin/waivers/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDialogError((data as { error?: string }).error ?? "Something went wrong");
      return false;
    }
    const updated: Waiver = await res.json();
    setWaivers((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    return true;
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFor) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { name: editName, description: editDescription };
      if (editFor.kind !== "OTHER") Object.assign(body, editScope);
      if (await patchWaiver(editFor.id, body)) setEditFor(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function setArchived(w: Waiver, archived: boolean) {
    setSubmitting(true);
    setPageError(null);
    try {
      const ok = await patchWaiver(w.id, { archived });
      if (!ok) setPageError("Could not update that waiver.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSignatures(versionId: string, q: string) {
    setSigsLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/waivers/${versionId}/signatures?${params}`);
    if (res.ok) setSignatures(await res.json());
    setSigsLoading(false);
  }

  async function openSignatures(waiver: Waiver, version: WaiverVersion) {
    setSigsFor({ waiver, version });
    setSignatures([]);
    setSigSearch("");
    await loadSignatures(version.id, "");
  }

  // Search a version's signers as the desk types (debounced).
  useEffect(() => {
    if (!sigsFor) return;
    const t = setTimeout(() => loadSignatures(sigsFor.version.id, sigSearch), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigSearch]);

  // Look a customer up by name or email across every waiver.
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
    if (!id) return "All studios";
    const loc = locations.find((l) => l.id === id);
    return loc ? shortLocationName(loc.name, loc.address) : "Unknown studio";
  };

  const signLink = (w: Waiver) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/waiver?${new URLSearchParams({ waiverId: w.id, callbackUrl: "/account" })}`;
  };

  async function copyLink(w: Waiver) {
    try {
      await navigator.clipboard.writeText(signLink(w));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }

  const active = waivers.filter((w) => !w.archivedAt);
  const archived = waivers.filter((w) => w.archivedAt);
  const kindOrder: WaiverKind[] = ["CLASS", "MEMBERSHIP", "OTHER"];

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Waivers</h1>
        <Button onClick={openNew}>New waiver</Button>
      </div>

      {pageError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{pageError}</p>
      )}

      {/* Who has signed? */}
      <section className="mb-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">Has someone signed?</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Search by name or email. Shows every waiver the customer has signed and whether it is
          the version currently in force.
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
                          <Badge variant="destructive">Nothing signed</Badge>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="align-top text-sm">
                            {u.signatures.map((sig) => (
                              <div key={sig.id} className="flex items-center gap-2 py-0.5">
                                <span>
                                  {sig.waiverName ?? `${sig.locationName ?? "Studio"} waiver`} v{sig.version}
                                  <span className="text-muted-foreground"> · {locationLabel(sig.locationId)}</span>
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

      {/* Every waiver, grouped by what it is for */}
      {active.length === 0 && (
        <p className="mb-8 text-sm text-muted-foreground">
          No waivers yet. Customers can book without signing anything until you publish a class waiver.
        </p>
      )}
      {kindOrder.map((kind) => {
        const group = active.filter((w) => w.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} className="mb-8">
            <h2 className="text-lg font-medium">{WAIVER_KIND_LABELS[kind]}s</h2>
            <p className="mb-3 text-sm text-muted-foreground">{WAIVER_KIND_HELP[kind].replace("this studio", "their studio")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {group.map((w) => {
                const current = currentVersion(w);
                return (
                  <div key={w.id} className="flex flex-col rounded-lg border p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {locationLabel(w.locationId)}
                          {current
                            ? ` · v${current.version} published ${formatDate(current.publishedAt)} · ${current._count.signatures} signed`
                            : " · no current version"}
                        </p>
                        {scopeLabel(w) && <p className="text-xs text-muted-foreground">{scopeLabel(w)}</p>}
                        {w.description && <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>}
                      </div>
                      <Badge variant="outline">{locationLabel(w.locationId)}</Badge>
                    </div>
                    {current && (
                      <div className="mb-3 max-h-40 overflow-hidden text-sm text-muted-foreground [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                        <RichText value={current.content} />
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2">
                      {current && (
                        <Button size="sm" variant="outline" onClick={() => setViewFor({ waiver: w, version: current })}>
                          Read
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openNewVersion(w)}>
                        Publish new version
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setLinkFor(w); setLinkCopied(false); }}>
                        Sign link
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(w)}>
                        {w.kind === "OTHER" ? "Rename" : "Rename / applies to"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setArchived(w, true)}
                        disabled={submitting}
                      >
                        Archive
                      </Button>
                    </div>
                    {w.versions.length > 0 && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-muted-foreground">
                          {w.versions.length} version{w.versions.length === 1 ? "" : "s"} · {signatureTotal(w)} signatures in all
                        </summary>
                        <Table className="mt-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Version</TableHead>
                              <TableHead>Published</TableHead>
                              <TableHead className="text-right">Signatures</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {w.versions.map((v) => (
                              <TableRow key={v.id}>
                                <TableCell>
                                  v{v.version}
                                  {v.isActive && <Badge className="ml-2">Current</Badge>}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{formatDate(v.publishedAt)}</TableCell>
                                <TableCell className="text-right">{v._count.signatures}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setViewFor({ waiver: w, version: v })}>
                                      Read
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => openSignatures(w, v)}>
                                      Signatures
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {archived.length > 0 && (
        <section className="mb-8">
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} {archived.length} archived waiver{archived.length === 1 ? "" : "s"}
          </button>
          {showArchived && (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Waiver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Studio</TableHead>
                  <TableHead className="text-right">Signatures</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>{WAIVER_KIND_LABELS[w.kind]}</TableCell>
                    <TableCell>{locationLabel(w.locationId)}</TableCell>
                    <TableCell className="text-right">{signatureTotal(w)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {w.versions[0] && (
                          <Button size="sm" variant="ghost" onClick={() => openSignatures(w, w.versions[0])}>
                            Signatures
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setArchived(w, false)} disabled={submitting}>
                          Restore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {/* New waiver dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[95vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New waiver</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitNew} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-name">Name</label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Provo class waiver, Membership agreement"
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="new-kind">Required for</label>
                <select
                  id="new-kind"
                  value={newKind}
                  onChange={(e) => { setNewKind(e.target.value as WaiverKind); setNewScope(DEFAULT_SCOPE); }}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {WAIVER_KINDS.map((k) => (
                    <option key={k} value={k}>{WAIVER_KIND_PICKER_LABELS[k]}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{WAIVER_KIND_HELP[newKind]}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="new-location">Studio</label>
                <select
                  id="new-location"
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">All studios</option>
                  {locations.filter((l) => l.isActive).map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  A studio-specific waiver is required only there. An all-studio one is required everywhere, on top of any studio-specific ones.
                </p>
              </div>
            </div>
            <ScopePicker
              idPrefix="new"
              kind={newKind}
              value={newScope}
              onChange={setNewScope}
              sessionTypes={sessionTypes}
              plans={plans}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-description">Note for staff (optional)</label>
              <Input
                id="new-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="When to use this one"
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-content">Waiver text</label>
              <RichTextEditor
                id="new-content"
                value={newContent}
                onChange={setNewContent}
                placeholder="Enter the full waiver text…"
                minHeight={320}
              />
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !newName.trim() || isRichTextEmpty(newContent)}>
                {submitting ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New version dialog */}
      <Dialog open={!!versionFor} onOpenChange={(o) => !o && setVersionFor(null)}>
        <DialogContent className="max-h-[95vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New version — {versionFor?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitNewVersion} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="version-content">Waiver text</label>
              <RichTextEditor
                id="version-content"
                value={versionContent}
                onChange={setVersionContent}
                placeholder="Enter the full waiver text…"
                minHeight={360}
              />
            </div>
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
            <p className="text-xs text-muted-foreground">
              Publishing replaces the current text of this waiver. Existing signatures stay on file
              against the version they signed; anyone who hasn&apos;t signed this new version will be
              asked to before it is needed again.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVersionFor(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || isRichTextEmpty(versionContent)}>
                {submitting ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit waiver</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-name">Name</label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="edit-description">Note for staff (optional)</label>
              <Input id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={500} />
            </div>
            {editFor && (
              <ScopePicker
                idPrefix="edit"
                kind={editFor.kind}
                value={editScope}
                onChange={setEditScope}
                sessionTypes={sessionTypes}
                plans={plans}
              />
            )}
            {editFor && (
              <p className="text-xs text-muted-foreground">
                {WAIVER_KIND_LABELS[editFor.kind]} · {locationLabel(editFor.locationId)}. To change the type or studio,
                archive this waiver and create a new one, so existing signatures keep meaning what they meant.
              </p>
            )}
            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditFor(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !editName.trim()}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign link dialog */}
      <Dialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign link — {linkFor?.name}</DialogTitle>
          </DialogHeader>
          {linkFor && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Anyone who opens this link signs in (or creates an account) and is shown the current
                version of this waiver. It keeps working after you publish a new version.
              </p>
              <Input readOnly value={signLink(linkFor)} onFocus={(e) => e.currentTarget.select()} />
              <div className="flex gap-2">
                <Button onClick={() => copyLink(linkFor)}>{linkCopied ? "Copied" : "Copy link"}</Button>
                <Button variant="outline" asChild>
                  <a href={`/admin/waivers/${linkFor.id}/qr`} target="_blank" rel="noopener noreferrer">
                    Print QR code
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Signatures dialog */}
      <Dialog open={!!sigsFor} onOpenChange={(o) => !o && setSigsFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {sigsFor?.waiver.name} v{sigsFor?.version.version}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({signatures.length} signatures)
              </span>
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Search signers by name or email…"
            value={sigSearch}
            onChange={(e) => setSigSearch(e.target.value)}
          />

          {sigsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
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
                        <p className="text-xs text-muted-foreground">{sig.user.email}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {sig.typedName ? sig.typedName : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {sig.signatureImageData ? (
                          <button onClick={() => setExpandedSig(sig.signatureImageData)} className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sig.signatureImageData}
                              alt="Signature"
                              style={{ height: 40 }}
                              className="rounded border bg-white object-contain"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Legacy signature</span>
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
            <Button variant="outline" onClick={() => setSigsFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full text of one version */}
      <Dialog open={!!viewFor} onOpenChange={(o) => !o && setViewFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {viewFor && `${viewFor.waiver.name} v${viewFor.version.version}`}
              {viewFor?.version.isActive && <Badge className="ml-2">Current</Badge>}
            </DialogTitle>
          </DialogHeader>
          {viewFor && (
            <div className="max-h-[65vh] overflow-y-auto rounded-lg border bg-white p-6">
              <RichText value={viewFor.version.content} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewFor(null)}>Close</Button>
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
              <img src={expandedSig} alt="Full signature" className="max-w-full object-contain" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpandedSig(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
