"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import { shortLocationName } from "@/lib/locationName";

/**
 * The franchise-level selection: every location at once. Kept under the
 * original constant name so existing consumers (schedule, class types) are
 * unaffected. Same value as ALL_LOCATIONS in src/lib/locationScope.ts, which
 * the API routes treat as "no narrowing".
 */
export const ALL_LOCATIONS = "__all__";

export interface LocationOption {
  id: string;
  name: string;
  /**
   * Short label for the switcher — "Lehi", "Provo" — derived from the full
   * name/address. See shortLocationName().
   */
  shortName: string;
}

interface LocationFilterContextValue {
  locations: LocationOption[];
  selectedLocationId: string; // ALL_LOCATIONS or a real Location.id
  setSelectedLocationId: (id: string) => void;
  loading: boolean;
  /** False for STAFF, who only ever see the studios they're assigned to. */
  canSelectAll: boolean;
}

const LocationFilterContext = createContext<LocationFilterContextValue>({
  locations: [],
  selectedLocationId: ALL_LOCATIONS,
  setSelectedLocationId: () => {},
  loading: true,
  canSelectAll: true,
});

export function useLocationFilter() {
  return useContext(LocationFilterContext);
}

/**
 * The `locationId` query-param value for a selection, or null for the
 * franchise view (omit the param). The server enforces the real scope either
 * way; this only narrows it.
 */
export function locationQueryValue(selectedLocationId: string): string | null {
  return selectedLocationId === ALL_LOCATIONS ? null : selectedLocationId;
}

/** Appends `locationId` to `url` for a single-studio selection. */
export function withLocationParam(url: string, selectedLocationId: string): string {
  const loc = locationQueryValue(selectedLocationId);
  if (!loc) return url;
  return `${url}${url.includes("?") ? "&" : "?"}locationId=${encodeURIComponent(loc)}`;
}

const STORAGE_KEY = "throw_admin_location_filter";

export function LocationFilterProvider({
  children,
  role,
  assignedLocationIds,
}: {
  children: React.ReactNode;
  role: Role;
  /** STAFF's StaffRoleAssignment locations, from the session. Ignored for ADMIN. */
  assignedLocationIds: string[];
}) {
  const canSelectAll = role !== "STAFF";
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationIdState] = useState(ALL_LOCATIONS);
  const [loading, setLoading] = useState(true);

  // Arrays from the server layout get a new identity every render; key the
  // effect on the contents instead.
  const assignedKey = assignedLocationIds.join(",");

  useEffect(() => {
    const assigned = assignedKey ? assignedKey.split(",") : [];

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore — private browsing, storage disabled, etc.
    }

    fetch("/api/admin/locations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; name: string; address: string | null; isActive: boolean }[]) => {
        const visible = data
          .filter((l) => l.isActive)
          .filter((l) => canSelectAll || assigned.includes(l.id))
          .map((l) => ({
            id: l.id,
            name: l.name,
            shortName: shortLocationName(l.name, l.address),
          }));
        setLocations(visible);

        const isValid = (id: string) =>
          (id === ALL_LOCATIONS && canSelectAll) || visible.some((l) => l.id === id);

        if (stored && isValid(stored)) {
          setSelectedLocationIdState(stored);
          return;
        }

        // A stored id can outlive the location it points at (deactivated,
        // unassigned, another environment's database) — drop it rather than
        // filtering every page by a dead id.
        if (stored) {
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        }

        // ADMIN starts in the franchise view; STAFF in their first studio.
        // A STAFF user with no studio stays on ALL_LOCATIONS, which the
        // server resolves to "nothing" for them.
        setSelectedLocationIdState(canSelectAll ? ALL_LOCATIONS : (visible[0]?.id ?? ALL_LOCATIONS));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canSelectAll, assignedKey]);

  function setSelectedLocationId(id: string) {
    if (id === ALL_LOCATIONS && !canSelectAll) return;
    setSelectedLocationIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  return (
    <LocationFilterContext.Provider
      value={{ locations, selectedLocationId, setSelectedLocationId, loading, canSelectAll }}
    >
      {children}
    </LocationFilterContext.Provider>
  );
}
