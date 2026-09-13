"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PieceStatus } from "@prisma/client";
import { DateRangePicker, defaultRange, type DateRange } from "@/components/shared/DateRangePicker";
import { formatMountainTime } from "@/lib/timezone";
import { ALL_LOCATIONS, useLocationFilter } from "@/app/admin/_components/LocationFilterContext";
import { PIECE_STATUSES, PIECE_STATUS_LABELS } from "@/app/api/pieces/_shared";

interface PieceRow {
  id: string;
  groupName: string | null;
  pieceCount: number;
  description: string;
  photoUrls: string[];
  status: PieceStatus;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  location: { id: string; name: string };
  studioSession: { id: string; startsAt: string; sessionTypeName: string } | null;
}

export function AdminPiecesClient() {
  const { selectedLocationId } = useLocationFilter();

  const [status, setStatus] = useState<PieceStatus | "ALL">("INTAKE");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [useDates, setUseDates] = useState(false);
  const [range, setRange] = useState<DateRange>(defaultRange);

  const [rows, setRows] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedLocationId && selectedLocationId !== ALL_LOCATIONS) params.set("locationId", selectedLocationId);
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (useDates) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    try {
      const res = await fetch(`/api/admin/pieces?${params.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to load pieces");
      }
      setRows((await res.json()) as PieceRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pieces");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, status, debouncedSearch, useDates, range]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(row: PieceRow, next: PieceStatus) {
    const previous = row.status;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const res = await fetch(`/api/admin/pieces/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r)));
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't update status");
    }
  }

  const showLocation = selectedLocationId === ALL_LOCATIONS;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h2" sx={{ fontWeight: 700 }}>
        Pieces
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Pottery logged by customers after their sessions.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, mb: 2, alignItems: { md: "center" }, flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Search customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Select
          size="small"
          value={status}
          onChange={(e) => setStatus(e.target.value as PieceStatus | "ALL")}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">All statuses</MenuItem>
          {PIECE_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {PIECE_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </Select>
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

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Photo</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Count</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Session</TableCell>
              {showLocation && <TableCell>Studio</TableCell>}
              <TableCell>Logged</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showLocation ? 8 : 7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showLocation ? 8 : 7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No pieces match these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    {r.photoUrls[0] ? (
                      <a href={r.photoUrls[0]} target="_blank" rel="noopener noreferrer">
                        <Avatar variant="rounded" src={r.photoUrls[0]} alt="" sx={{ width: 48, height: 48 }} />
                      </a>
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 48, height: 48, fontSize: "0.7rem" }}>
                        —
                      </Avatar>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.user.name ?? r.user.email}
                    </Typography>
                    {r.groupName && (
                      <Typography variant="caption" color="text.secondary">
                        {r.groupName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{r.pieceCount}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {r.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.studioSession ? (
                      <>
                        <Typography variant="body2">{r.studioSession.sessionTypeName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMountainTime(new Date(r.studioSession.startsAt), "datetime")}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  {showLocation && <TableCell>{r.location.name}</TableCell>}
                  <TableCell>{formatMountainTime(new Date(r.createdAt), "date")}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={r.status}
                      onChange={(e) => changeStatus(r, e.target.value as PieceStatus)}
                      sx={{ minWidth: 160 }}
                    >
                      {PIECE_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {PIECE_STATUS_LABELS[s]}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length >= 300 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Showing the 300 most recent matches — narrow the filters to see older pieces.
        </Typography>
      )}
    </Box>
  );
}
