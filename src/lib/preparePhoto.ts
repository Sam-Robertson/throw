/**
 * Browser-side photo preparation for piece uploads. Phone photos run 3–12 MB,
 * and the upload goes through our own API route (a Vercel function, whose
 * request body is capped at 4.5 MB), so the browser shrinks the photo first:
 * decoded, scaled to at most UPLOAD_MAX_EDGE on the long side, and re-encoded
 * as a JPEG. That is plenty for a photo of a mug, and makes uploads fast on
 * studio Wi-Fi.
 *
 * When the browser cannot decode the file (HEIC in Chrome, say), the original
 * is sent as-is if it is small enough; otherwise the caller gets TOO_LARGE.
 */

export const UPLOAD_MAX_EDGE = 1800;
/** Largest body our upload route accepts; under Vercel's 4.5 MB function limit. */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

export interface PreparedPhoto {
  body: Blob;
  contentType: string;
  fileName: string;
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super("TOO_LARGE");
    this.name = "PhotoTooLargeError";
  }
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // "from-image" applies the EXIF rotation phones record, so portrait shots
    // don't come out sideways. Older browsers reject the option; retry without.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

export async function preparePhotoForUpload(file: File): Promise<PreparedPhoto> {
  try {
    const bitmap = await decode(file);
    try {
      const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      if (!blob) throw new Error("encode failed");
      return {
        body: blob,
        contentType: "image/jpeg",
        fileName: `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    if (file.size <= UPLOAD_MAX_BYTES) {
      return { body: file, contentType: file.type, fileName: file.name };
    }
    throw new PhotoTooLargeError();
  }
}
