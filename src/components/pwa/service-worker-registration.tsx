"use client";

import { useEffect } from "react";
import { attachInstallListeners } from "./install-store";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Mounted on every page (root layout): the browser's install dialog is
    // stashed wherever it's offered, for the install card to open later.
    // (install-store also attaches as soon as its module loads; idempotent.)
    attachInstallListeners();
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching interfering with dev/Turbopack HMR
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a progressive enhancement — a failed registration is never surfaced.
    });
  }, []);
  return null;
}
