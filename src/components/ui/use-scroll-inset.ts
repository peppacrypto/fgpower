"use client";

import { useEffect, type RefObject } from "react";

/**
 * While a fixed/sticky bottom bar is on screen, reserve its height as
 * scroll-padding on the document so a control scrolled or focused into view is
 * never left under the bar (WCAG 2.4.11). Writes --sp-bar on <html> and clears
 * it on unmount; a ResizeObserver keeps it in step as the bar grows (a second
 * line, an undo/error row). Only one such bar exists per screen (the workout
 * rest bar, or the builder save bar), so a single variable never collides.
 */
export function useBottomBarInset(ref: RefObject<HTMLElement | null>) {
  useInset(ref, "--sp-bar");
}

/** The sticky top (the live-workout header): reserve its height as scroll-padding-top. */
export function useTopBarInset(ref: RefObject<HTMLElement | null>) {
  useInset(ref, "--sp-top");
}

/**
 * iOS's install banner (components/pwa/install-banner.tsx): it floats over
 * the bottom of any page, so its height is reserved both as scroll-padding and
 * as room at the end of the page (globals.css) — nothing stays under it.
 * Its own variable: it can share a screen with a bar above.
 */
export function useInstallBannerInset(ref: RefObject<HTMLElement | null>) {
  useInset(ref, "--sp-install");
}

function useInset(ref: RefObject<HTMLElement | null>, prop: "--sp-bar" | "--sp-top" | "--sp-install") {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty(prop, `${Math.ceil(el.offsetHeight)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(prop);
    };
  }, [ref, prop]);
}
