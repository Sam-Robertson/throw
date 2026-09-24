"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { PiecePhotoUploader } from "@/components/shared/PiecePhotoUploader";
import { TEXT_CONSENT_WORDING } from "@/app/api/pieces/_shared";

export interface SessionOption {
  id: string;
  label: string;
  instructorName: string | null;
}

export function PieceForm({
  userId,
  sessions,
  defaultSessionId,
  defaultPhone,
  location,
}: {
  userId: string;
  sessions: SessionOption[];
  defaultSessionId: string;
  /** The phone on the customer's profile, if any. */
  defaultPhone: string;
  /** The studio whose QR poster was scanned, so pieces go to its kiln queue. */
  location: { id: string; name: string } | null;
}) {
  const router = useRouter();

  const [studioSessionId, setStudioSessionId] = useState(defaultSessionId);
  const [groupName, setGroupName] = useState("");
  const [pieceCount, setPieceCount] = useState("1");
  const [description, setDescription] = useState("");
  const [instructorName, setInstructorName] = useState(
    sessions.find((s) => s.id === defaultSessionId)?.instructorName ?? "",
  );
  const [instructorEdited, setInstructorEdited] = useState(false);
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [textOptIn, setTextOptIn] = useState(true);
  const [sharePermission, setSharePermission] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseSession(id: string) {
    setStudioSessionId(id);
    // Follow the session's instructor until the customer types their own.
    if (!instructorEdited) setInstructorName(sessions.find((s) => s.id === id)?.instructorName ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (textOptIn && contactPhone.replace(/\D/g, "").length < 10) {
      setError("Add a mobile number so we can text you, or turn off the text.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioSessionId: studioSessionId || null,
          locationId: location?.id ?? null,
          groupName,
          pieceCount: Number(pieceCount),
          description,
          photoUrls,
          sharePermission,
          textOptIn,
          contactPhone: contactPhone.trim() || null,
          instructorName: instructorName.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't log your pieces. Please try again.");
        return;
      }
      router.push("/pieces?logged=1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack sx={{ gap: 2.5 }}>
        {location && (
          <Alert severity="info" icon={false}>
            Logging pieces at <strong>{location.name}</strong>.
          </Alert>
        )}

        {sessions.length > 0 && (
          <TextField
            select
            label="Session"
            value={studioSessionId}
            onChange={(e) => chooseSession(e.target.value)}
            helperText="The class or open studio session you made them in"
          >
            <MenuItem value="">Not sure / not listed</MenuItem>
            {sessions.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label="Group name (optional)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          helperText="Write it on every piece so we can match them up — e.g. your name, or a name for your group"
          slotProps={{ htmlInput: { maxLength: 120 } }}
        />

        <TextField
          label="Number of pieces"
          type="number"
          required
          value={pieceCount}
          onChange={(e) => setPieceCount(e.target.value)}
          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
        />

        <TextField
          label="Description"
          required
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          helperText="What they are, and anything that helps us tell them apart (glaze colours, initials on the base)"
          slotProps={{ htmlInput: { maxLength: 2000 } }}
        />

        <TextField
          label="Instructor (optional)"
          value={instructorName}
          onChange={(e) => {
            setInstructorEdited(true);
            setInstructorName(e.target.value);
          }}
          slotProps={{ htmlInput: { maxLength: 120 } }}
        />

        <PiecePhotoUploader ownerUserId={userId} value={photoUrls} onChange={setPhotoUrls} onUploadingChange={setUploading} />

        <Box>
          <FormControlLabel
            control={<Switch checked={textOptIn} onChange={(e) => setTextOptIn(e.target.checked)} />}
            label="Text me when they're ready"
          />
          {textOptIn && (
            <>
              <TextField
                label="Mobile number to text"
                type="tel"
                required
                fullWidth
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                sx={{ mt: 1 }}
                slotProps={{ htmlInput: { inputMode: "tel", maxLength: 40 } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {TEXT_CONSENT_WORDING}
              </Typography>
            </>
          )}
        </Box>

        <FormControlLabel
          control={<Checkbox checked={sharePermission} onChange={(e) => setSharePermission(e.target.checked)} />}
          label="The studio may share photos of my pieces on social media"
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="contained" size="large" disabled={submitting || uploading}>
          {submitting ? "Saving…" : "Log pieces"}
        </Button>
      </Stack>
    </Box>
  );
}
