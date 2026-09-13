import type { PieceStatus } from "@prisma/client";

// Shared by the customer and admin piece routes/pages. Kept free of runtime
// Prisma imports so client components can use it.

export const MAX_PIECE_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const PIECE_STATUSES = [
  "INTAKE",
  "DRYING",
  "BISQUE",
  "GLAZE",
  "READY",
  "PICKED_UP",
] as const satisfies readonly PieceStatus[];

export const PIECE_STATUS_LABELS: Record<PieceStatus, string> = {
  INTAKE: "Logged",
  DRYING: "Drying",
  BISQUE: "Bisque firing",
  GLAZE: "Glaze firing",
  READY: "Ready for pickup",
  PICKED_UP: "Picked up",
};

export function isPieceStatus(value: unknown): value is PieceStatus {
  return typeof value === "string" && (PIECE_STATUSES as readonly string[]).includes(value);
}

/** Blob pathname prefix every photo a user uploads must sit under. */
export function piecePhotoPrefix(userId: string): string {
  return `pieces/${userId}/`;
}

/** True for a Vercel Blob URL under this user's piece-photo prefix. */
export function isOwnPiecePhotoUrl(url: string, userId: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".blob.vercel-storage.com") &&
      u.pathname.startsWith(`/${piecePhotoPrefix(userId)}`)
    );
  } catch {
    return false;
  }
}
