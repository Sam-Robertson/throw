import type { PieceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuppressed, normalizeEmail, normalizePhone } from "@/lib/consent";
import { shortLocationName } from "@/lib/locationName";
import { resend } from "@/lib/resend";
import { sendSms } from "@/lib/sms";
import { realEmail } from "@/lib/walkinEmail";
import { pieceCountLabel } from "@/app/api/pieces/_shared";

/**
 * The "your pottery is ready" loop that the old Google Form ran by hand.
 *
 * When a piece becomes READY and the customer asked to be texted
 * (`textOptIn`), they get one SMS at the number they wrote on the form
 * (`contactPhone`, else the account phone). It is transactional — they asked
 * for exactly this message — so marketing consent doesn't apply, but the
 * suppression list does: a STOP reply is never texted again. With no phone
 * but a real email, the same note goes by email. `readyNotifiedAt` stops a
 * second send unless staff ask for a resend.
 */

const DEFAULT_FROM = "Throw Art Studio <hello@throwartstudio.com>";

export type NotifyChannel = "sms" | "email" | "none";

export interface NotifyResult {
  notified: NotifyChannel;
  /** Why nothing went out, or why the send failed. */
  reason?: string;
  to?: string;
}

const PIECE_NOTIFY_SELECT = {
  id: true,
  status: true,
  pieceCount: true,
  groupName: true,
  contactName: true,
  contactPhone: true,
  textOptIn: true,
  readyNotifiedAt: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
  location: { select: { name: true, address: true } },
} as const;

type NotifyPiece = {
  id: string;
  pieceCount: number;
  groupName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  textOptIn: boolean;
  readyNotifiedAt: Date | null;
  user: { id: string; name: string | null; email: string; phone: string | null };
  location: { name: string; address: string | null };
};

function firstName(piece: NotifyPiece): string | null {
  const name = (piece.contactName ?? piece.user.name)?.trim();
  return name ? name.split(/\s+/)[0] : null;
}

/** The phone the customer wants texted: what they wrote on the form, else the account. */
export function pieceContactPhone(piece: { contactPhone: string | null; user: { phone: string | null } }): string | null {
  const raw = piece.contactPhone ?? piece.user.phone;
  if (!raw || raw.replace(/\D/g, "").length < 10) return null;
  return normalizePhone(raw);
}

export function buildReadyMessage(piece: NotifyPiece): string {
  const studio = shortLocationName(piece.location.name, piece.location.address);
  const name = firstName(piece);
  const group = piece.groupName ? `, group "${piece.groupName}"` : "";
  return `Hi ${name ?? "there"}, your pottery from Throw ${studio} is ready for pickup! ${pieceCountLabel(piece.pieceCount)}${group}. Reply STOP to opt out.`;
}

/**
 * Sends the ready-for-pickup message for one piece, if it should go out.
 * Records `readyNotifiedAt` on success. Never sends twice unless `resend`.
 */
export async function notifyPieceReady(pieceId: string, opts: { resend?: boolean } = {}): Promise<NotifyResult> {
  const piece = await prisma.piece.findUnique({ where: { id: pieceId }, select: PIECE_NOTIFY_SELECT });
  if (!piece) return { notified: "none", reason: "Piece not found" };
  if (piece.status !== "READY") return { notified: "none", reason: "Not ready" };
  if (!piece.textOptIn) return { notified: "none", reason: "No consent" };
  if (piece.readyNotifiedAt && !opts.resend) return { notified: "none", reason: "Already notified" };

  const phone = pieceContactPhone(piece);
  if (phone) {
    if (await isSuppressed("SMS", phone)) return { notified: "none", reason: "Number opted out of texts" };
    const result = await sendSms({
      to: phone,
      message: buildReadyMessage(piece),
      userId: piece.user.id,
      kind: "transactional",
    });
    if (!result.ok) return { notified: "none", reason: result.error ?? "Text failed to send" };
    await prisma.piece.update({ where: { id: piece.id }, data: { readyNotifiedAt: new Date() } });
    return { notified: "sms", to: phone };
  }

  const email = realEmail(piece.user.email);
  if (!email) return { notified: "none", reason: "No phone or email" };
  if (await isSuppressed("EMAIL", normalizeEmail(email))) {
    return { notified: "none", reason: "Email address opted out or bounced" };
  }
  const studio = shortLocationName(piece.location.name, piece.location.address);
  const name = firstName(piece);
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to: email,
      subject: `Your pottery is ready for pickup at Throw ${studio}`,
      text: [
        name ? `Hi ${name},` : "Hi,",
        "",
        `Your pottery from Throw ${studio} is ready for pickup! ${pieceCountLabel(piece.pieceCount)}${
          piece.groupName ? `, group "${piece.groupName}"` : ""
        }.`,
        "",
        "Come by during studio hours to collect it.",
        "",
        "See you soon,",
        "Throw Art Studio",
      ].join("\n"),
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Failed to email piece-ready note:", err);
    return { notified: "none", reason: "Email failed to send" };
  }
  await prisma.piece.update({ where: { id: piece.id }, data: { readyNotifiedAt: new Date() } });
  return { notified: "email", to: email };
}

export interface PieceUpdate {
  status?: PieceStatus;
  bagged?: boolean;
  staffNote?: string | null;
}

/**
 * Applies a staff update to one piece and sends the ready text when the
 * status becomes READY. PICKED_UP stamps `pickedUpAt`. The caller has already
 * checked the piece is in scope.
 */
export async function applyPieceUpdate(
  pieceId: string,
  update: PieceUpdate,
  opts: { resend?: boolean } = {},
): Promise<NotifyResult & { status: PieceStatus; bagged: boolean; readyNotifiedAt: Date | null; pickedUpAt: Date | null }> {
  const data: {
    status?: PieceStatus;
    bagged?: boolean;
    staffNote?: string | null;
    pickedUpAt?: Date | null;
  } = {};
  if (update.status !== undefined) {
    data.status = update.status;
    if (update.status === "PICKED_UP") data.pickedUpAt = new Date();
  }
  if (update.bagged !== undefined) data.bagged = update.bagged;
  if (update.staffNote !== undefined) data.staffNote = update.staffNote;

  const updated = await prisma.piece.update({
    where: { id: pieceId },
    data,
    select: { id: true, status: true, bagged: true, readyNotifiedAt: true, pickedUpAt: true },
  });

  let notify: NotifyResult = { notified: "none" };
  if (updated.status === "READY" && (update.status === "READY" || opts.resend)) {
    notify = await notifyPieceReady(pieceId, opts);
    if (notify.notified !== "none") updated.readyNotifiedAt = new Date();
  }

  return { ...updated, ...notify };
}
