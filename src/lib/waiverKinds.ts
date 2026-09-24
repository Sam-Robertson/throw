// Waiver kinds, shared by server code and client components (no Prisma here).
//
//   CLASS       required before booking or attending a class at that studio
//   MEMBERSHIP  required before starting a membership at that studio
//   OTHER       never automatically; signed via its link or QR code

export const WAIVER_KINDS = ["CLASS", "MEMBERSHIP", "OTHER"] as const;
export type WaiverKind = (typeof WAIVER_KINDS)[number];

export const WAIVER_KIND_LABELS: Record<WaiverKind, string> = {
  CLASS: "Class waiver",
  MEMBERSHIP: "Membership waiver",
  OTHER: "Other",
};

/** When each kind is asked for, in words the admin page shows. */
export const WAIVER_KIND_HELP: Record<WaiverKind, string> = {
  CLASS: "Customers must sign it before booking or being checked into a class at this studio.",
  MEMBERSHIP: "Customers must sign it before starting a membership at this studio.",
  OTHER: "Not required automatically. Share its link or QR code when you need it signed.",
};

export function isWaiverKind(value: unknown): value is WaiverKind {
  return typeof value === "string" && (WAIVER_KINDS as readonly string[]).includes(value);
}
