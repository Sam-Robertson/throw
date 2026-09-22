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

/** Short labels for chips and the customer stepper. */
export const PIECE_STATUS_SHORT_LABELS: Record<PieceStatus, string> = {
  INTAKE: "Logged",
  DRYING: "Drying",
  BISQUE: "Bisque",
  GLAZE: "Glaze",
  READY: "Ready",
  PICKED_UP: "Picked up",
};

/** The kiln queue: everything still in the studio. `?status=NOT_PICKED_UP`. */
export const NOT_PICKED_UP = "NOT_PICKED_UP";
export const ACTIVE_PIECE_STATUSES = PIECE_STATUSES.filter((s) => s !== "PICKED_UP");

/**
 * The wording customers agree to for the ready-for-pickup text, carried over
 * from the old Google Form so consent means the same thing it always has.
 */
export const TEXT_CONSENT_WORDING =
  "By turning this on you agree to receive text messages from Throw Art Studio about your finished pottery pieces. Message and data rates may apply. Reply STOP to opt out.";

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

/** The fields a customer or the front desk fills in about the pieces themselves. */
export interface PieceFields {
  groupName: string | null;
  pieceCount: number;
  description: string;
  photoUrls: string[];
  sharePermission: boolean;
  textOptIn: boolean;
  /** As typed; the route normalises it to E.164. */
  contactPhone: string | null;
  instructorName: string | null;
}

/**
 * Validates the piece fields of a request body. Photo URLs must be Blob URLs
 * under one of `photoOwnerIds`' prefixes (the customer the pieces belong to;
 * at the desk, also the staff member who took the photo). Returns an error
 * message, or the parsed fields.
 */
export function parsePieceFields(b: Record<string, unknown>, photoOwnerIds: string | string[]): PieceFields | string {
  const owners = Array.isArray(photoOwnerIds) ? photoOwnerIds : [photoOwnerIds];
  const groupName =
    typeof b.groupName === "string" && b.groupName.trim() ? b.groupName.trim().slice(0, 120) : null;

  const pieceCount = typeof b.pieceCount === "number" ? b.pieceCount : Number(b.pieceCount);
  if (!Number.isInteger(pieceCount) || pieceCount < 1 || pieceCount > 100) {
    return "Piece count must be a whole number between 1 and 100";
  }

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (!description) return "Please describe the pieces";
  if (description.length > 2000) return "Description is too long (2,000 characters max)";

  const photoUrls = Array.isArray(b.photoUrls) ? b.photoUrls : [];
  if (photoUrls.length > MAX_PIECE_PHOTOS) return `Up to ${MAX_PIECE_PHOTOS} photos per entry`;
  if (
    !photoUrls.every(
      (u): u is string => typeof u === "string" && owners.some((owner) => isOwnPiecePhotoUrl(u, owner)),
    )
  ) {
    return "One of the photos isn't a valid upload";
  }

  const contactPhone =
    typeof b.contactPhone === "string" && b.contactPhone.trim() ? b.contactPhone.trim().slice(0, 40) : null;
  if (contactPhone) {
    const digits = contactPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return "That phone number doesn't look right";
  }

  const instructorName =
    typeof b.instructorName === "string" && b.instructorName.trim()
      ? b.instructorName.trim().slice(0, 120)
      : null;

  return {
    groupName,
    pieceCount,
    description,
    photoUrls,
    sharePermission: b.sharePermission === true,
    textOptIn: b.textOptIn === true,
    contactPhone,
    instructorName,
  };
}

export function pieceCountLabel(count: number): string {
  return `${count} ${count === 1 ? "piece" : "pieces"}`;
}

/** Whole days between when the pieces were logged and now. */
export function daysSince(iso: string | Date, now: Date = new Date()): number {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}
