import QRCode from "qrcode";

/** The site's public origin, for links that leave the app (texts, emails, printed QR codes). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** An SVG QR code for `text`, as markup to inline. Server-only. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
