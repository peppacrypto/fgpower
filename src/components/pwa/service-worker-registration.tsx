"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching interfering with dev/Turbopack HMR
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a progressive enhancement — never surface this to the user.
    });
  }, []);
  return null;
}
