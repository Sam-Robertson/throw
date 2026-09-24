"use client";

import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { PiecePhotoUploader } from "@/components/shared/PiecePhotoUploader";
import { formatMountainTime } from "@/lib/timezone";
import { realEmail } from "@/lib/walkinEmail";
import { ALL_LOCATIONS, useLocationFilter } from "@/app/admin/_components/LocationFilterContext";
import { TEXT_CONSENT_WORDING, pieceCountLabel } from "@/app/api/pieces/_shared";
import { BackLink } from "@/components/shared/BackLink";

interface CustomerMatch {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
}

interface SessionOption {
  id: string;
  label: string;
  instructorName: string | null;
}

interface AdminSession {
  id: string;
  startsAt: string;
  title: string | null;
  sessionType: { name: string };
  instructor: { id: string; name: string | null } | null;
}

interface CreatedPiece {
  piece: { id: string; pieceCount: number; contactPhone: string | null; textOptIn: boolean; groupName: string | null };
  customer: { id: string; name: string | null; email: string; phone: string | null };
  createdCustomer: boolean;
}

type CustomerMode = "find" | "new";

const JSON_HEADERS = { "Content-Type": "application/json" };
const SESSION_LOOKBACK_DAYS = 7;

export function DeskIntakeClient() {
  const { locations, selectedLocationId, loading: locationsLoading } = useLocationFilter();
  const searchParams = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId");

  // Studio: the sidebar's studio, or a picker in the franchise view.
  const [locationId, setLocationId] = useState("");
  useEffect(() => {
    if (selectedLocationId !== ALL_LOCATIONS) setLocationId(selectedLocationId);
    else if (locations.length === 1) setLocationId(locations[0].id);
  }, [selectedLocationId, locations]);

  const [staffId, setStaffId] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: { id?: string } }) => setStaffId(d?.user?.id ?? null))
      .catch(() => {});
  }, []);

  // Customer
  const [mode, setMode] = useState<CustomerMode>("find");
  const [customer, setCustomer] = useState<CustomerMatch | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newEmail, setNewEmail] = useState("");

  // What goes on the piece
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [studioSessionId, setStudioSessionId] = useState("");
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [groupName, setGroupName] = useState("");
  const [pieceCount, setPieceCount] = useState("1");
  const [description, setDescription] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [textOptIn, setTextOptIn] = useState(true);
  const [sharePermission, setSharePermission] = useState(false);
  const [instructorName, setInstructorName] = useState("");
  const [instructorEdited, setInstructorEdited] = useState(false);
  const [staffNote, setStaffNote] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CreatedPiece | null>(null);

  // ?customerId= from the register's customer panel.
  useEffect(() => {
    if (!prefillCustomerId) return;
    fetch(`/api/admin/customers/${prefillCustomerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: CustomerMatch | null) => c && pickCustomer(c))
      .catch(() => {});
  }, [prefillCustomerId]);

  // Debounced name/email/phone search.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setMatches([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(query.trim())}`).catch(() => null);
      if (res?.ok) setMatches((await res.json()) as CustomerMatch[]);
      setSearching(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  // Recent sessions at this studio, most recent first.
  useEffect(() => {
    if (!locationId) {
      setSessions([]);
      return;
    }
    const now = new Date();
    const from = new Date(now.getTime() - SESSION_LOOKBACK_DAYS * 86_400_000);
    const to = new Date(now.getTime() + 86_400_000);
    const params = new URLSearchParams({ locationId, from: from.toISOString(), to: to.toISOString() });
    fetch(`/api/admin/studio-sessions?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: AdminSession[]) => {
        const upcomingCutoff = now.getTime() + 3 * 3_600_000;
        setSessions(
          list
            .filter((s) => new Date(s.startsAt).getTime() <= upcomingCutoff)
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
            .map((s) => ({
              id: s.id,
              label: `${s.title ?? s.sessionType.name} — ${formatMountainTime(new Date(s.startsAt), "datetime")}${
                s.instructor?.name ? ` · ${s.instructor.name}` : ""
              }`,
              instructorName: s.instructor?.name ?? null,
            })),
        );
      })
      .catch(() => setSessions([]));
  }, [locationId]);

  function pickCustomer(c: CustomerMatch) {
    setCustomer(c);
    setMode("find");
    setQuery("");
    setMatches([]);
    setContactName(c.name ?? "");
    setContactPhone(c.phone ?? "");
  }

  function clearCustomer() {
    setCustomer(null);
    setContactName("");
    setContactPhone("");
  }

  function chooseSession(id: string) {
    setStudioSessionId(id);
    if (!instructorEdited) setInstructorName(sessions.find((s) => s.id === id)?.instructorName ?? "");
  }

  function resetForAnother() {
    clearCustomer();
    setMode("find");
    setNewEmail("");
    setGroupName("");
    setPieceCount("1");
    setDescription("");
    setPhotoUrls([]);
    setTextOptIn(true);
    setSharePermission(false);
    setStaffNote("");
    setError(null);
    setDone(null);
    // Studio, session and instructor stay: the next person is usually from
    // the same class.
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!locationId) {
      setError("Choose a studio.");
      return;
    }
    if (!customer && !contactName.trim()) {
      setError("Enter the customer's name.");
      return;
    }
    if (textOptIn && contactPhone.replace(/\D/g, "").length < 10) {
      setError("Enter a mobile number to text, or turn off \"Text when ready\".");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pieces", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          customerId: customer?.id ?? undefined,
          contactName: contactName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          email: !customer && newEmail.trim() ? newEmail.trim() : undefined,
          locationId,
          studioSessionId: studioSessionId || null,
          groupName,
          pieceCount: Number(pieceCount),
          description,
          photoUrls,
          sharePermission,
          textOptIn,
          instructorName: instructorName.trim() || null,
          staffNote: staffNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't log the pieces. Please try again.");
        return;
      }
      setDone((await res.json()) as CreatedPiece);
    } finally {
      setSubmitting(false);
    }
  }

  const studioName = locations.find((l) => l.id === locationId)?.shortName ?? null;
  const photoOwnerId = customer?.id ?? staffId;

  if (done) {
    const who = done.customer.name ?? realEmail(done.customer.email) ?? "the customer";
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 640 }}>
        <Alert severity="success" sx={{ mb: 3, fontSize: "1rem" }}>
          Logged {pieceCountLabel(done.piece.pieceCount)} for <strong>{who}</strong>
          {done.piece.groupName ? ` (group "${done.piece.groupName}")` : ""}
          {studioName ? ` at ${studioName}` : ""}.
          {done.createdCustomer && " New customer created."}
        </Alert>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {done.piece.textOptIn && done.piece.contactPhone
            ? `We'll text ${done.piece.contactPhone} when they're ready.`
            : "No text will be sent for these pieces — they'll need to check with the studio."}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5 }}>
          <Button variant="contained" size="large" onClick={resetForAnother} sx={{ minHeight: 56 }}>
            Log another
          </Button>
          <Button component={NextLink} href="/admin/pieces" variant="outlined" size="large" sx={{ minHeight: 56 }}>
            Kiln queue
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720 }}>
      <BackLink href="/admin/pieces">Pieces</BackLink>
      <Typography variant="h2" sx={{ fontWeight: 700 }}>
        Log pieces at the desk
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        What the paper form used to collect. Write the group name on every piece.
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack sx={{ gap: 3 }}>
          {/* Studio */}
          {selectedLocationId === ALL_LOCATIONS && locations.length > 1 ? (
            <TextField
              select
              required
              label="Studio"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              helperText="Which studio the pieces are at"
            >
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.shortName}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography variant="body2">
              Studio: <strong>{studioName ?? (locationsLoading ? "…" : "none selected")}</strong>
            </Typography>
          )}

          {/* Customer */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Customer
            </Typography>
            {customer ? (
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {customer.name ?? realEmail(customer.email) ?? "Customer"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[customer.phone, realEmail(customer.email)].filter(Boolean).join(" · ") || "No contact details on file"}
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={clearCustomer} sx={{ minHeight: 44 }}>
                  Change
                </Button>
              </Box>
            ) : (
              <>
                <ToggleButtonGroup
                  exclusive
                  value={mode}
                  onChange={(_, v: CustomerMode | null) => v && setMode(v)}
                  sx={{ mb: 2, "& .MuiToggleButton-root": { minHeight: 44, px: 2 } }}
                >
                  <ToggleButton value="find">Find customer</ToggleButton>
                  <ToggleButton value="new">New / walk-in</ToggleButton>
                </ToggleButtonGroup>

                {mode === "find" && (
                  <>
                    <TextField
                      fullWidth
                      autoFocus
                      label="Search by name, email or phone"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {searching && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Searching…
                      </Typography>
                    )}
                    {!searching && query.trim() && matches.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        No one found. Try &ldquo;New / walk-in&rdquo;.
                      </Typography>
                    )}
                    {matches.length > 0 && (
                      <List dense sx={{ mt: 1, border: 1, borderColor: "divider", borderRadius: 2, maxHeight: 280, overflowY: "auto" }}>
                        {matches.map((c) => (
                          <ListItemButton key={c.id} onClick={() => pickCustomer(c)} sx={{ minHeight: 48 }}>
                            <ListItemText
                              primary={c.name ?? realEmail(c.email) ?? "Customer"}
                              secondary={[c.phone, realEmail(c.email)].filter(Boolean).join(" · ") || "No contact details"}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </>
                )}

                {mode === "new" && (
                  <Typography variant="body2" color="text.secondary">
                    Fill in their name and phone below. An account is created from those, or matched if the number is
                    already on file.
                  </Typography>
                )}
              </>
            )}
          </Paper>

          <TextField
            label="Full name (so we know who to contact)"
            required={!customer}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            label="Phone number to text when ready"
            type="tel"
            required={textOptIn}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            helperText={customer && customer.phone && contactPhone !== customer.phone ? "Different from the number on their account — the text goes to this one." : undefined}
            slotProps={{ htmlInput: { inputMode: "tel", maxLength: 40 } }}
          />
          {!customer && mode === "new" && (
            <TextField
              label="Email (optional)"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              slotProps={{ htmlInput: { inputMode: "email", maxLength: 200 } }}
            />
          )}

          {/* Session */}
          <TextField
            select
            label="Session (optional)"
            value={studioSessionId}
            onChange={(e) => chooseSession(e.target.value)}
            helperText={locationId ? `Sessions at this studio in the last ${SESSION_LOOKBACK_DAYS} days` : "Choose a studio first"}
            disabled={!locationId}
          >
            <MenuItem value="">Not listed / open studio</MenuItem>
            {sessions.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Instructor (optional)"
            value={instructorName}
            onChange={(e) => {
              setInstructorEdited(true);
              setInstructorName(e.target.value);
            }}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />

          <TextField
            label="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            helperText="Written on every piece the group made — otherwise we can't track them"
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />

          <TextField
            label="How many pieces in total"
            type="number"
            required
            value={pieceCount}
            onChange={(e) => setPieceCount(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: 100, step: 1, inputMode: "numeric" } }}
          />

          <TextField
            label="Description"
            required
            multiline
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Piece 1: blue and white; piece 2: pink with flowers…"
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />

          {photoOwnerId ? (
            <PiecePhotoUploader
              ownerUserId={photoOwnerId}
              value={photoUrls}
              onChange={setPhotoUrls}
              onUploadingChange={setUploading}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Photos: loading…
            </Typography>
          )}

          <Box>
            <FormControlLabel
              control={<Switch checked={textOptIn} onChange={(e) => setTextOptIn(e.target.checked)} />}
              label="Text when ready"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Read to the customer: {TEXT_CONSENT_WORDING}
            </Typography>
          </Box>

          <FormControlLabel
            control={<Switch checked={sharePermission} onChange={(e) => setSharePermission(e.target.checked)} />}
            label="OK to share photos of their pieces on social media"
          />

          <TextField
            label="Staff note (not shown to the customer)"
            multiline
            minRows={2}
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || uploading || !locationId}
            sx={{ minHeight: 56, fontSize: "1.1rem" }}
          >
            {submitting ? "Saving…" : "Log pieces"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
