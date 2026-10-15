import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PIECE_PHOTOS,
  piecePhotoPrefix,
} from "@/app/api/pieces/_shared";
import { UPLOAD_MAX_BYTES } from "@/lib/preparePhoto";

/**
 * Piece photo uploads. The browser shrinks the photo (see
 * src/lib/preparePhoto.ts) and PUTs it here; this route stores it in Vercel
 * Blob with the server token and returns the public URL. The Piece row stores
 * the URLs when the intake form is submitted (POST /api/pieces checks that
 * every URL sits under the right customer's prefix and caps them at
 * MAX_PIECE_PHOTOS).
 *
 * This replaced Vercel Blob *client* uploads (browser → Blob directly with a
 * short-lived token) on 2026-10-14: in production the browser's PUT to the
 * Blob API failed its CORS check and the client library retried it for
 * minutes, which is the "Uploading…" that never finished.
 */

/** `pieces/<userId>/…` for any user id — staff uploading on a customer's behalf. */
const STAFF_UPLOAD_PATH = /^pieces\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

function uploadsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// GET /api/upload — lets the form know whether photo upload is available.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    configured: uploadsConfigured(),
    maxFiles: MAX_PIECE_PHOTOS,
    maxBytes: UPLOAD_MAX_BYTES,
    allowedTypes: ALLOWED_PHOTO_TYPES,
  });
}

// PUT /api/upload?pathname=pieces/<userId>/<file> — the photo bytes as the body.
export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uploadsConfigured()) {
    return NextResponse.json({ error: "UPLOADS_NOT_CONFIGURED" }, { status: 503 });
  }

  const pathname = new URL(request.url).searchParams.get("pathname") ?? "";
  // Customers upload under their own prefix only. Staff logging pieces at the
  // desk upload under the *customer's* prefix, so the photos pass the
  // ownership check when the Piece is created.
  const isStaff = session.user.role === "ADMIN" || session.user.role === "STAFF";
  const allowed =
    STAFF_UPLOAD_PATH.test(pathname) &&
    (isStaff || pathname.startsWith(piecePhotoPrefix(session.user.id)));
  if (!allowed) return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_PHOTO_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > UPLOAD_MAX_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
  if (body.byteLength > UPLOAD_MAX_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });

  try {
    const blob = await put(pathname, body, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[upload] Blob put failed:", err);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 502 });
  }
}
