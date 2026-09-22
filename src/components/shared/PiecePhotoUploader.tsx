"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PIECE_PHOTOS,
  piecePhotoPrefix,
} from "@/app/api/pieces/_shared";

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "photo";
}

/**
 * Piece photos via Vercel Blob client uploads. Shared by the customer intake
 * form and the front-desk intake: `ownerUserId` is the customer the pieces
 * belong to, and the photos land under their `pieces/<userId>/` prefix (staff
 * sessions may upload under any customer's prefix; see /api/upload).
 */
export function PiecePhotoUploader({
  ownerUserId,
  value,
  onChange,
  onUploadingChange,
  disabled,
}: {
  ownerUserId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadsAvailable, setUploadsAvailable] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean }>) : { configured: false }))
      .then((d) => setUploadsAvailable(d.configured))
      .catch(() => setUploadsAvailable(false));
  }, []);

  function setBusy(next: boolean) {
    setUploading(next);
    onUploadingChange?.(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = MAX_PIECE_PHOTOS - value.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`You can add up to ${MAX_PIECE_PHOTOS} photos.`);

    const bad = chosen.find((f) => !ALLOWED_PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO_BYTES);
    if (bad) {
      setError(`"${bad.name}" isn't a supported photo (JPEG, PNG, WebP or HEIC, up to 10 MB).`);
      return;
    }

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of chosen) {
        const blob = await upload(`${piecePhotoPrefix(ownerUserId)}${safeFileName(file.name)}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: file.type,
        });
        uploaded.push(blob.url);
      }
      onChange([...value, ...uploaded].slice(0, MAX_PIECE_PHOTOS));
    } catch {
      setError("A photo failed to upload. You can try again, or log the pieces without it.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Photos (optional, up to {MAX_PIECE_PHOTOS})
      </Typography>
      {uploadsAvailable === false ? (
        <Alert severity="info">Photo uploads aren&apos;t switched on yet — you can still log the pieces without photos.</Alert>
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
            disabled={disabled || uploadsAvailable === null || uploading || value.length >= MAX_PIECE_PHOTOS}
            sx={{ minHeight: 44 }}
          >
            {uploading ? "Uploading…" : "Add photos"}
          </Button>
        </>
      )}
      {value.length > 0 && (
        <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {value.map((url, i) => (
            <Box key={url} sx={{ position: "relative" }}>
              <Avatar variant="rounded" src={url} alt={`Photo ${i + 1}`} sx={{ width: 72, height: 72 }} />
              <IconButton
                size="small"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(value.filter((u) => u !== url))}
                sx={{ position: "absolute", top: -8, right: -8, bgcolor: "background.paper", boxShadow: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
