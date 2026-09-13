import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PIECE_PHOTOS,
  piecePhotoPrefix,
} from "@/app/api/pieces/_shared";

/**
 * Piece photo uploads via Vercel Blob *client* uploads: the browser asks this
 * route for a short-lived token, then sends the file straight to Blob. A plain
 * server-side put() would push the photo through this function, and Vercel caps
 * function request bodies at 4.5 MB — a single phone photo can exceed that.
 *
 * The per-entry limit of 5 photos is enforced by POST /api/pieces, which only
 * accepts up to MAX_PIECE_PHOTOS URLs under the caller's own prefix.
 */

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
    maxBytes: MAX_PHOTO_BYTES,
    allowedTypes: ALLOWED_PHOTO_TYPES,
  });
}

// POST /api/upload — client-token exchange (from the browser) and the
// upload-completed callback (from Vercel Blob, signature-verified by handleUpload).
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only Vercel Blob's upload-completed callback arrives without a session
  // (handleUpload verifies its signature). Everything else — the browser's
  // token request, or any malformed body — must be signed in, and is checked
  // before the configuration check so anonymous callers get 401, not 503.
  if (body.type !== "blob.upload-completed") {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!uploadsConfigured()) {
    return NextResponse.json({ error: "UPLOADS_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!session) throw new Error("Unauthorized");
        if (!pathname.startsWith(piecePhotoPrefix(session.user.id))) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_PHOTO_TYPES,
          maximumSizeInBytes: MAX_PHOTO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to record: the Piece row stores the URLs when the form is
        // submitted. (Vercel can't reach this callback on localhost anyway.)
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
