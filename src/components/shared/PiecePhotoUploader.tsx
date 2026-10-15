"use client";

import { useEffect, useRef, useState } from "react";
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
import { PhotoTooLargeError, preparePhotoForUpload } from "@/lib/preparePhoto";

/** How long one photo may take before the form gives up and lets staff carry on. */
const UPLOAD_TIMEOUT_MS = 90_000;

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "photo";
}

class UploadError extends Error {}

/**
 * Sends one prepared photo through PUT /api/upload and returns its public URL.
 * Throws UploadError with a message fit for the form.
 */
async function uploadOne(ownerUserId: string, file: File): Promise<string> {
  let prepared;
  try {
    prepared = await preparePhotoForUpload(file);
  } catch (err) {
    if (err instanceof PhotoTooLargeError) {
      throw new UploadError(`"${file.name}" is too big to send from this device. Try a JPEG under 4 MB.`);
    }
    throw new UploadError(`"${file.name}" couldn't be read as a photo.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const pathname = `${piecePhotoPrefix(ownerUserId)}${safeFileName(prepared.fileName)}`;
    const res = await fetch(`/api/upload?pathname=${encodeURIComponent(pathname)}`, {
      method: "PUT",
      headers: { "content-type": prepared.contentType },
      body: prepared.body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (data.error === "TOO_LARGE") {
        throw new UploadError(`"${file.name}" is too big to upload. Try a smaller photo.`);
      }
      throw new UploadError(`"${file.name}" failed to upload (${data.message ?? data.error ?? res.status}).`);
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  } catch (err) {
    if (err instanceof UploadError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new UploadError(`"${file.name}" took too long to upload. Check the connection and try again.`);
    }
    throw new UploadError(`"${file.name}" failed to upload. Check the connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Piece photos, shrunk in the browser and stored through /api/upload. Shared
 * by the customer intake form and the front-desk intake: `ownerUserId` is the
 * customer the pieces belong to, and the photos land under their
 * `pieces/<userId>/` prefix (staff sessions may upload under any customer's
 * prefix; see /api/upload).
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => (r.ok ? (r.json() as Promise<{ configured: boolean }>) : { configured: false }))
      .then((d) => setUploadsAvailable(d.configured))
      .catch(() => setUploadsAvailable(false));
  }, []);

  const uploading = progress !== null;

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

    setProgress({ done: 0, total: chosen.length });
    onUploadingChange?.(true);
    const uploaded: string[] = [];
    try {
      for (const file of chosen) {
        uploaded.push(await uploadOne(ownerUserId, file));
        setProgress({ done: uploaded.length, total: chosen.length });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "A photo failed to upload.";
      setError(`${message} You can try again, or log the pieces without it.`);
    } finally {
      // Whatever happened, keep the photos that did make it and free the form.
      if (uploaded.length > 0) onChange([...value, ...uploaded].slice(0, MAX_PIECE_PHOTOS));
      setProgress(null);
      onUploadingChange?.(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const buttonLabel = progress
    ? progress.total > 1
      ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
      : "Uploading…"
    : "Add photos";

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
            {buttonLabel}
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
