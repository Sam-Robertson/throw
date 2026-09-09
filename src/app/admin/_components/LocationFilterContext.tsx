"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { shortLocationName } from "@/lib/locationName";

/**
 * The franchise-level selection: every location at once. Kept under the
 * original constant name so existing consumers (schedule, class types) are
 * unaffected.
 */
export const ALL_LOCATIONS = "__all__";

/**
 * Scope the admin starts in when the user has no stored preference.
 *
 * Provo is the only studio actually operating — Lehi's schedule exists but
 * doesn't open until October — so landing on the franchise view would show
 * staff a mix of live and not-yet-open sessions. Falls back to the franchise
 * view if no studio matches. Change or drop this once Lehi is running.
 */
const DEFAULT_SCOPE_SHORT_NAME = "Provo";

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
}

const LocationFilterContext = createContext<LocationFilterContextValue>({
  locations: [],
  selectedLocationId: ALL_LOCATIONS,
  setSelectedLocationId: () => {},
  loading: true,
});

export function useLocationFilter() {
  return useContext(LocationFilterContext);
}

const STORAGE_KEY = "throw_admin_location_filter";

export function LocationFilterProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationIdState] = useState(ALL_LOCATIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let hadStored = false;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        hadStored = true;
        setSelectedLocationIdState(stored);
      }
    } catch {
      // ignore — private browsing, storage disabled, etc.
    }

    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((data: { id: string; name: string; address: string | null; isActive: boolean }[]) => {
        const active = data
          .filter((l) => l.isActive)
          .map((l) => ({
            id: l.id,
            name: l.name,
            shortName: shortLocationName(l.name, l.address),
          }));
        setLocations(active);

        const fallback =
          active.find((l) => l.shortName === DEFAULT_SCOPE_SHORT_NAME)?.id ?? ALL_LOCATIONS;

        setSelectedLocationIdState((current) => {
          // Nothing stored yet — start in the default scope rather than the
          // franchise view. `hadStored` is captured above, before the fetch.
          if (!hadStored) return fallback;
          if (current === ALL_LOCATIONS) return current;
          if (active.some((l) => l.id === current)) return current;

          // A stored id can outlive the location it points at — deactivated,
          // deleted, or a different environment's database. Left alone, the
          // switcher would fall back to showing "All Locations" while every
          // page kept filtering by the dead id and rendering nothing.
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
          return fallback;
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function setSelectedLocationId(id: string) {
    setSelectedLocationIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  return (
    <LocationFilterContext.Provider value={{ locations, selectedLocationId, setSelectedLocationId, loading }}>
      {children}
    </LocationFilterContext.Provider>
  );
}
