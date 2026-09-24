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
  CLASS: "Customers must sign it before booking or being checked into a class at this studio. Applies to every class, or only courses, events or chosen class types.",
  MEMBERSHIP: "Customers must sign it before starting a membership at this studio. Applies to every plan or only chosen plans.",
  OTHER: "Not required automatically. Share its link or QR code when you need it signed.",
};

export function isWaiverKind(value: unknown): value is WaiverKind {
  return typeof value === "string" && (WAIVER_KINDS as readonly string[]).includes(value);
}

// What a waiver of a kind applies to (Waiver.appliesTo). "ALL" is the default
// and what every waiver did before September 2026. OTHER waivers ignore it.
export const CLASS_SCOPES = ["ALL", "EVENTS", "COURSES", "SELECTED"] as const;
export const MEMBERSHIP_SCOPES = ["ALL", "SELECTED"] as const;
export type WaiverScope = (typeof CLASS_SCOPES)[number];

export const WAIVER_SCOPE_LABELS: Record<WaiverKind, Partial<Record<WaiverScope, string>>> = {
  CLASS: {
    ALL: "Every class, event and course",
    EVENTS: "Classes and events only (not courses)",
    COURSES: "Courses only",
    SELECTED: "Only the class types I choose",
  },
  MEMBERSHIP: {
    ALL: "Every membership plan",
    SELECTED: "Only the plans I choose",
  },
  OTHER: {},
};

export function scopesForKind(kind: WaiverKind): readonly WaiverScope[] {
  if (kind === "CLASS") return CLASS_SCOPES;
  if (kind === "MEMBERSHIP") return MEMBERSHIP_SCOPES;
  return ["ALL"];
}

export function isWaiverScope(kind: WaiverKind, value: unknown): value is WaiverScope {
  return typeof value === "string" && (scopesForKind(kind) as readonly string[]).includes(value);
}
