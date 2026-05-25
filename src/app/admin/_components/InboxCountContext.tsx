"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface InboxCountContextValue {
  unreadCount: number;
  refresh: () => void;
}

const InboxCountContext = createContext<InboxCountContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function useInboxCount() {
  return useContext(InboxCountContext);
}

export function InboxCountProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  async function fetchCount() {
    try {
      const res = await fetch("/api/admin/inbox/unread-count");
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setUnreadCount(data.count);
      }
    } catch {
      // swallow — network error during navigation, etc.
    }
  }

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30_000); // poll every 30 s
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <InboxCountContext.Provider value={{ unreadCount, refresh: fetchCount }}>
      {children}
    </InboxCountContext.Provider>
  );
}
