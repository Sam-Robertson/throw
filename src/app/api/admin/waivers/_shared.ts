// What the admin waiver routes return: a waiver with every version, newest first.
export const WAIVER_ADMIN_SELECT = {
  id: true,
  name: true,
  kind: true,
  locationId: true,
  description: true,
  archivedAt: true,
  createdAt: true,
  location: { select: { id: true, name: true, address: true } },
  versions: {
    orderBy: { version: "desc" as const },
    select: {
      id: true,
      version: true,
      publishedAt: true,
      isActive: true,
      content: true,
      _count: { select: { signatures: true } },
    },
  },
} as const;
