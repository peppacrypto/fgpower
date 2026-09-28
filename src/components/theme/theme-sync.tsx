"use client";

/**
 * Re-applies the device's theme choice after hydration (W-149, owned by C6):
 * dev Strict Mode resets <html> attributes, and Next may insert theme-color
 * metas after the boot script ran.
 *
 * Phase 0 stub: renders nothing.
 */
export function ThemeSync() {
  return null;
}
