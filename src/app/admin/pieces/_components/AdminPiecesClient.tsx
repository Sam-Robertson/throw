"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import type { PieceStatus } from "@prisma/client";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/shared/DateRangePicker";
import { formatMountainTime } from "@/lib/timezone";
import { realEmail } from "@/lib/walkinEmail";
import { ALL_LOCATIONS, useLocationFilter } from "@/app/admin/_components/LocationFilterContext";
import {
  NOT_PICKED_UP,
  PIECE_STATUSES,
  PIECE_STATUS_LABELS,
  PIECE_STATUS_SHORT_LABELS,
  daysSince,
} from "@/app/api/pieces/_shared";

interface PieceRow {
  id: string;
  userId: string;
  groupName: string | null;
  pieceCount: number;
  description: string;
  photoUrls: string[];
  status: PieceStatus;
  contactName: string | null;
  contactPhone: string | null;
  textOptIn: boolean;
  instructorName: string | null;
  staffNote: string | null;
  bagged: boolean;
  readyNotifiedAt: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; phone: string | null };
  loggedBy: { id: string; name: string | null } | null;
  location: { id: string; name: string };
  studioSession: { id: string; startsAt: string; sessionTypeName: string; instructorName: string | null } | null;
}

interface UpdateResponse {
  id: string;
  status: PieceStatus;
  bagged: boolean;
  readyNotifiedAt: string | null;
  pickedUpAt: string | null;
  notified: "sms" | "email" | "none";
  reason?: string;
  to?: string;
}

interface BulkResponse {
  results: { id: string; ok: boolean; error?: string; status?: PieceStatus; notified?: "sms" | "email" | "none"; reason?: string }[];
  summary: { updated: number; failed: number; texted: number; emailed: number };
}

type StatusFilter = PieceStatus | typeof NOT_PICKED_UP | "ALL";

const JSON_HEADERS = { "Content-Type": "application/json" };

function rowPhone(r: PieceRow): string | null {
  return r.contactPhone ?? r.user.phone;
}

function customerName(r: PieceRow): string {
  return r.contactName ?? r.user.name ?? realEmail(r.user.email) ?? "Walk-in";
}

/** "Texted Sep 20" / "Not texted (no consent)" / … */
function notifyLabel(r: PieceRow): { text: string; tone: "success" | "warning" | "muted" } {
  const phone = rowPhone(r);
  if (r.readyNotifiedAt) {
    const when = formatMountainTime(new Date(r.readyNotifiedAt), "date");
    return { text: phone ? `Text sent ${when}` : `Email sent ${when}`, tone: "success" };
  }
  if (!r.textOptIn) return { text: "Not texted (no consent)", tone: "muted" };
  if (!phone) {
    return realEmail(r.user.email)
      ? { text: r.status === "READY" ? "Not sent (no phone; email on file)" : "No phone — will email", tone: "warning" }
      : { text: "Not texted (no phone)", tone: "warning" };
  }
  return r.status === "READY" ? { text: "Not texted yet", tone: "warning" } : { text: `Will text ${phone}`, tone: "muted" };
}

function describeNotify(res: UpdateResponse): string | null {
  if (res.notified === "sms") return `Texted ${res.to ?? "the customer"}.`;
  if (res.notified === "email") return `Emailed ${res.to ?? "the customer"}.`;
  if (res.status === "READY" && res.reason && res.reason !== "Already notified") return `Not texted: ${res.reason}.`;
  return null;
}

export function AdminPiecesClient() {
  const { selectedLocationId } = useLocationFilter();
  const searchParams = useSearchParams();
  const userIdFilter = searchParams.get("userId");

  const [status, setStatus] = useState<StatusFilter>(NOT_PICKED_UP);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [useDates, setUseDates] = useState(false);
  const [range, setRange] = useState<DateRange>(defaultRange);

  const [rows, setRows] = useState<PieceRow[]>([]);
  const [counts, setCounts] = useState<Partial<Record<PieceStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PieceStatus | "">("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const baseParams = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedLocationId && selectedLocationId !== ALL_LOCATIONS) params.set("locationId", selectedLocationId);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (userIdFilter) params.set("userId", userIdFilter);
    if (useDates) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    return params;
  }, [selectedLocationId, debouncedSearch, userIdFilter, useDates, range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = baseParams();
    if (status !== "ALL") params.set("status", status);
    const countParams = baseParams();
    countParams.set("counts", "1");
    try {
      const [res, countRes] = await Promise.all([
        fetch(`/api/admin/pieces?${params.toString()}`),
        fetch(`/api/admin/pieces?${countParams.toString()}`),
      ]);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to load pieces");
      }
      const loaded = (await res.json()) as PieceRow[];
      setRows(loaded);
      setNoteDrafts(Object.fromEntries(loaded.map((r) => [r.id, r.staffNote ?? ""])));
      setSelected(new Set());
      if (countRes.ok) setCounts(((await countRes.json()) as { counts: Partial<Record<PieceStatus, number>> }).counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pieces");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseParams, status]);

  useEffect(() => {
    load();
  }, [load]);

  const inStudioCount = useMemo(
    () => PIECE_STATUSES.filter((s) => s !== "PICKED_UP").reduce((n, s) => n + (counts[s] ?? 0), 0),
    [counts],
  );

  function applyUpdate(id: string, res: UpdateResponse) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: res.status, bagged: res.bagged, readyNotifiedAt: res.readyNotifiedAt, pickedUpAt: res.pickedUpAt }
          : r,
      ),
    );
  }

  async function patch(row: PieceRow, body: Record<string, unknown>, resend = false): Promise<UpdateResponse | null> {
    const res = await fetch(`/api/admin/pieces/${row.id}${resend ? "?resend=1" : ""}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(data.error ?? "Couldn't update the piece");
      return null;
    }
    return (await res.json()) as UpdateResponse;
  }

  async function changeStatus(row: PieceRow, next: PieceStatus) {
    const previous = row.status;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const res = await patch(row, { status: next });
    if (!res) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r)));
      return;
    }
    applyUpdate(row.id, res);
    const msg = describeNotify(res);
    if (msg) setNotice(msg);
    // Counts shift; refresh them without reloading rows (the row may have
    // left the current filter, but staff want to see what they just did).
    const countParams = baseParams();
    countParams.set("counts", "1");
    fetch(`/api/admin/pieces?${countParams.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { counts?: Partial<Record<PieceStatus, number>> } | null) => d?.counts && setCounts(d.counts))
      .catch(() => {});
  }

  async function toggleBagged(row: PieceRow, bagged: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, bagged } : r)));
    const res = await patch(row, { bagged });
    if (!res) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, bagged: !bagged } : r)));
  }

  async function saveNote(row: PieceRow) {
    const draft = (noteDrafts[row.id] ?? "").trim();
    if (draft === (row.staffNote ?? "")) return;
    const res = await patch(row, { staffNote: draft || null });
    if (res) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, staffNote: draft || null } : r)));
  }

  async function resendText(row: PieceRow) {
    const res = await patch(row, {}, true);
    if (!res) return;
    applyUpdate(row.id, res);
    setNotice(describeNotify(res) ?? (res.reason ? `Not sent: ${res.reason}.` : "Nothing sent."));
  }

  async function runBulk(body: { status?: PieceStatus; bagged?: boolean }) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/admin/pieces/bulk", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ids: Array.from(selected), ...body }),
    }).catch(() => null);
    setBulkBusy(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(data.error ?? "Bulk update failed");
      return;
    }
    const data = (await res.json()) as BulkResponse;
    const parts = [`${data.summary.updated} updated`];
    if (body.status === "READY") {
      parts.push(`${data.summary.texted} texted`);
      if (data.summary.emailed > 0) parts.push(`${data.summary.emailed} emailed`);
      const notSent = data.results.filter((r) => r.ok && r.notified === "none" && r.reason && r.reason !== "Already notified").length;
      if (notSent > 0) parts.push(`${notSent} not texted`);
    }
    if (data.summary.failed > 0) parts.push(`${data.summary.failed} failed`);
    setNotice(parts.join(", ") + ".");
    setBulkStatus("");
    await load();
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const showLocation = selectedLocationId === ALL_LOCATIONS;
  const colSpan = showLocation ? 10 : 9;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const chip = (value: StatusFilter, label: string, count: number | undefined) => (
    <Chip
      key={value}
      label={count === undefined ? label : `${label} · ${count}`}
      clickable
      color={status === value ? "primary" : "default"}
      variant={status === value ? "filled" : "outlined"}
      onClick={() => setStatus(value)}
      sx={{ minHeight: 44, fontSize: "0.9rem", px: 0.5 }}
    />
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>
            Pieces
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            The kiln queue: everything in the studio, oldest first within each stage.
          </Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button component={NextLink} href="/admin/pieces/qr" target="_blank" variant="outlined" sx={{ minHeight: 44 }}>
            Print QR poster
          </Button>
          <Button component={NextLink} href="/admin/pieces/new" variant="contained" startIcon={<AddIcon />} sx={{ minHeight: 44 }}>
            Log pieces
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Customers log their own pieces by scanning the QR poster (it opens the form for this studio).
        Log pieces here only for someone who can&apos;t.
      </Typography>

      <Stack direction="row" sx={{ gap: 1, mt: 3, mb: 2, flexWrap: "wrap" }}>
        {chip(NOT_PICKED_UP, "Kiln queue", inStudioCount)}
        {PIECE_STATUSES.map((s) => chip(s, PIECE_STATUS_SHORT_LABELS[s], counts[s] ?? 0))}
        {chip("ALL", "All", undefined)}
      </Stack>

      {userIdFilter && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={NextLink} href="/admin/pieces" size="small">
              Show everyone
            </Button>
          }
        >
          Showing one customer&apos;s pieces{rows[0] ? `: ${customerName(rows[0])}` : ""}.
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, mb: 2, alignItems: { md: "center" }, flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Search name, phone, group"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <FormControlLabel
          control={<Switch checked={useDates} onChange={(e) => setUseDates(e.target.checked)} />}
          label="Filter by date logged"
        />
      </Stack>
      {useDates && (
        <Box sx={{ mb: 2 }}>
          <DateRangePicker value={range} onChange={setRange} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {selected.size > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 3, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selected.size} selected
          </Typography>
          <Select
            size="small"
            displayEmpty
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PieceStatus | "")}
            sx={{ minWidth: 200, minHeight: 44 }}
          >
            <MenuItem value="">Mark selected as…</MenuItem>
            {PIECE_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {PIECE_STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="contained"
            disabled={!bulkStatus || bulkBusy}
            onClick={() => bulkStatus && runBulk({ status: bulkStatus })}
            sx={{ minHeight: 44 }}
          >
            Apply
          </Button>
          <Button variant="outlined" disabled={bulkBusy} onClick={() => runBulk({ bagged: true })} sx={{ minHeight: 44 }}>
            Mark bagged
          </Button>
          <Button disabled={bulkBusy} onClick={() => setSelected(new Set())} sx={{ minHeight: 44 }}>
            Clear
          </Button>
        </Paper>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={selected.size > 0 && !allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  slotProps={{ input: { "aria-label": "Select all" } }}
                />
              </TableCell>
              <TableCell>Photos</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Pieces</TableCell>
              <TableCell>Session</TableCell>
              {showLocation && <TableCell>Studio</TableCell>}
              <TableCell>Staff note</TableCell>
              <TableCell align="center">Bagged</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Text</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colSpan}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No pieces match these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const phone = rowPhone(r);
                const email = realEmail(r.user.email);
                const notify = notifyLabel(r);
                const days = daysSince(r.createdAt);
                const instructor = r.instructorName ?? r.studioSession?.instructorName ?? null;
                return (
                  <TableRow key={r.id} hover selected={selected.has(r.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                        slotProps={{ input: { "aria-label": `Select ${customerName(r)}` } }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 60 }}>
                      {r.photoUrls.length > 0 ? (
                        <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", maxWidth: 120 }}>
                          {r.photoUrls.map((url, i) => (
                            <Avatar
                              key={url}
                              variant="rounded"
                              src={url}
                              alt={`Photo ${i + 1}`}
                              onClick={() => setLightbox(url)}
                              sx={{ width: 48, height: 48, cursor: "pointer" }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 48, height: 48, fontSize: "0.7rem" }}>
                          —
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {customerName(r)}
                      </Typography>
                      {phone && (
                        <Link href={`tel:${phone}`} variant="body2" sx={{ display: "block", minHeight: 24 }}>
                          {phone}
                        </Link>
                      )}
                      {email && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-all" }}>
                          {email}
                        </Typography>
                      )}
                      {r.groupName && (
                        <Chip label={r.groupName} size="small" sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.pieceCount} {r.pieceCount === 1 ? "piece" : "pieces"}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {r.description}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      {r.studioSession ? (
                        <>
                          <Typography variant="body2">{r.studioSession.sessionTypeName}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {formatMountainTime(new Date(r.studioSession.startsAt), "datetime")}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No session
                        </Typography>
                      )}
                      {instructor && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Instructor: {instructor}
                        </Typography>
                      )}
                      <Tooltip title={`Logged ${formatMountainTime(new Date(r.createdAt), "datetime")}${r.loggedBy ? ` by ${r.loggedBy.name ?? "staff"}` : " by the customer"}`}>
                        <Typography
                          variant="caption"
                          sx={{ display: "block", fontWeight: 600, color: days >= 21 ? "error.main" : days >= 14 ? "warning.main" : "text.secondary" }}
                        >
                          {days === 0 ? "Logged today" : `${days} day${days === 1 ? "" : "s"} ago`}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    {showLocation && <TableCell>{r.location.name}</TableCell>}
                    <TableCell sx={{ minWidth: 160 }}>
                      <TextField
                        size="small"
                        multiline
                        maxRows={3}
                        placeholder="Add a note"
                        value={noteDrafts[r.id] ?? ""}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        onBlur={() => saveNote(r)}
                        fullWidth
                        slotProps={{ htmlInput: { maxLength: 2000, "aria-label": "Staff note" } }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={r.bagged}
                        onChange={(e) => toggleBagged(r, e.target.checked)}
                        slotProps={{ input: { "aria-label": "Bagged" } }}
                        sx={{ p: 1.25 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={r.status}
                        onChange={(e) => changeStatus(r, e.target.value as PieceStatus)}
                        sx={{ minWidth: 160, minHeight: 44 }}
                      >
                        {PIECE_STATUSES.map((s) => (
                          <MenuItem key={s} value={s}>
                            {PIECE_STATUS_LABELS[s]}
                          </MenuItem>
                        ))}
                      </Select>
                      {r.pickedUpAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          Picked up {formatMountainTime(new Date(r.pickedUpAt), "date")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 600,
                          color: notify.tone === "success" ? "success.main" : notify.tone === "warning" ? "warning.main" : "text.secondary",
                        }}
                      >
                        {notify.text}
                      </Typography>
                      {r.status === "READY" && r.textOptIn && (phone || email) && (
                        <Button size="small" onClick={() => resendText(r)} sx={{ minHeight: 44, px: 0.5 }}>
                          {r.readyNotifiedAt ? "Resend" : "Send now"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length >= 300 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Showing 300 pieces — narrow the filters to see the rest.
        </Typography>
      )}

      <Dialog open={!!lightbox} onClose={() => setLightbox(null)} maxWidth="lg">
        {lightbox && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightbox} alt="Piece photo" style={{ maxWidth: "90vw", maxHeight: "90vh", display: "block" }} />
        )}
      </Dialog>

      <Snackbar
        open={!!notice}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
