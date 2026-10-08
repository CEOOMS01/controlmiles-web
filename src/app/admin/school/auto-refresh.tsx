"use client";

// Re-renders the live board every few seconds. The map itself updates in
// real time (vehicles Realtime channel); the route cards come from the
// server, so a light refresh keeps them in step without a second socket.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
