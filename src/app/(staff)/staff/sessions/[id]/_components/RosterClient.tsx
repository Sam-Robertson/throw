"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

export interface RosterRow {
  bookingId: string;
  customerName: string;
  status: "CONFIRMED" | "NO_SHOW";
  source: string;
  waiverSigned: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  MEMBERSHIP_CREDIT: "Membership",
  MEMBER_FREE: "Member Free",
  DROP_IN: "Drop-in",
  COMP: "Comp",
};

export function RosterClient({ initialRoster }: { initialRoster: RosterRow[] }) {
  const [roster, setRoster] = useState(initialRoster);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function toggle(bookingId: string, newStatus: "NO_SHOW" | "CONFIRMED") {
    setUpdatingId(bookingId);
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setRoster((prev) =>
        prev.map((r) => (r.bookingId === bookingId ? { ...r, status: newStatus } : r)),
      );
    }
    setUpdatingId(null);
  }

  if (roster.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No confirmed bookings for this session.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>Customer</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>Source</TableCell>
            <TableCell sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>Waiver</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {roster.map((r) => (
            <TableRow key={r.bookingId} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{r.customerName}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={r.status === "NO_SHOW" ? "No-show" : "Confirmed"}
                  size="small"
                  color={r.status === "NO_SHOW" ? "error" : "success"}
                />
              </TableCell>
              <TableCell>
                <Chip label={SOURCE_LABEL[r.source] ?? r.source} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                {r.waiverSigned ? (
                  <Typography variant="body2" color="success.main">Signed</Typography>
                ) : (
                  <Chip label="Waiver needed" size="small" color="error" />
                )}
              </TableCell>
              <TableCell align="right">
                {r.status === "CONFIRMED" ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={updatingId === r.bookingId}
                    onClick={() => toggle(r.bookingId, "NO_SHOW")}
                  >
                    Mark no-show
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={updatingId === r.bookingId}
                    onClick={() => toggle(r.bookingId, "CONFIRMED")}
                  >
                    Undo no-show
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
