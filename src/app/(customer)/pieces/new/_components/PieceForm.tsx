"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PIECE_PHOTOS,
  piecePhotoPrefix,
} from "@/app/api/pieces/_shared";

export interface SessionOption {
  id: string;
  label: string;
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "photo";
}

export function PieceForm({
  userId,
  sessions,
  defaultSessionId,
}: {
  userId: string;
  sessions: SessionOption[];
  defaultSessionId: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [studioSessionId, setStudioSessionId] = useState(defaultSessionId);
  const [groupName, setGroupName] = useState("");
  const [pieceCount, setPieceCount] = useState("1");
  const [description, setDescription] = useState("");
  const [sharePermission, setSharePermission] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const [uploadsAvailable, setUploadsAvailable] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean }>) : { configured: false }))
      .then((d) => setUploadsAvailable(d.configured))
      .catch(() => setUploadsAvailable(false));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PIECE_PHOTOS - photoUrls.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`You can add up to ${MAX_PIECE_PHOTOS} photos.`);

    const bad = chosen.find((f) => !ALLOWED_PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO_BYTES);
    if (bad) {
      setError(`"${bad.name}" isn't a supported photo (JPEG, PNG, WebP or HEIC, up to 10 MB).`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of chosen) {
        const blob = await upload(`${piecePhotoPrefix(userId)}${safeFileName(file.name)}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: file.type,
        });
        uploaded.push(blob.url);
      }
      setPhotoUrls((prev) => [...prev, ...uploaded].slice(0, MAX_PIECE_PHOTOS));
    } catch {
      setError("A photo failed to upload. You can try again, or log your pieces without it.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioSessionId: studioSessionId || null,
          groupName,
          pieceCount: Number(pieceCount),
          description,
          photoUrls,
          sharePermission,
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
        <TextField
          select
          label="Session"
          value={studioSessionId}
          onChange={(e) => setStudioSessionId(e.target.value)}
          helperText="The class or open studio session you made them in"
        >
          <MenuItem value="">Not sure / not listed</MenuItem>
          {sessions.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Group name (optional)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          helperText="e.g. your name, or a name for a group of friends"
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

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Photos (optional, up to {MAX_PIECE_PHOTOS})
          </Typography>
          {uploadsAvailable === false ? (
            <Alert severity="info">
              Photo uploads aren&apos;t switched on yet — you can still log your pieces without photos.
            </Alert>
          ) : (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={ALLOWED_PHOTO_TYPES.join(",")}
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                variant="outlined"
                onClick={() => fileInput.current?.click()}
                disabled={uploadsAvailable === null || uploading || photoUrls.length >= MAX_PIECE_PHOTOS}
              >
                {uploading ? "Uploading…" : "Add photos"}
              </Button>
            </>
          )}
          {photoUrls.length > 0 && (
            <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>
              {photoUrls.map((url, i) => (
                <Box key={url} sx={{ position: "relative" }}>
                  <Avatar variant="rounded" src={url} alt={`Photo ${i + 1}`} sx={{ width: 72, height: 72 }} />
                  <IconButton
                    size="small"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                    sx={{ position: "absolute", top: -8, right: -8, bgcolor: "background.paper", boxShadow: 1 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
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
