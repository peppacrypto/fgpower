import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canGoBack, noteBackNavigation, recordNavigation, resetNavHistory } from "./nav-history";

beforeEach(() => resetNavHistory());
afterEach(() => vi.unstubAllGlobals());

describe("nav history with the Navigation API", () => {
  it("follows the browser's own answer for the current entry", () => {
    // Deep link, one tap in, then the system back button: the counter says 3
    // pages, but the entry is the first of the visit.
    recordNavigation("/u/ana");
    recordNavigation("/app/feed");
    recordNavigation("/u/ana");
    vi.stubGlobal("navigation", { canGoBack: false });
    expect(canGoBack()).toBe(false);
    vi.stubGlobal("navigation", { canGoBack: true });
    resetNavHistory();
    expect(canGoBack()).toBe(true);
  });
});

describe("nav history", () => {
  it("can't go back from the first page of a visit", () => {
    recordNavigation("/u/ana");
    expect(canGoBack()).toBe(false);
  });

  it("can after an in-app navigation; the same path twice counts once", () => {
    recordNavigation("/app/feed");
    recordNavigation("/app/feed");
    expect(canGoBack()).toBe(false);
    recordNavigation("/u/ana");
    expect(canGoBack()).toBe(true);
  });

  it("going back lands on a page that counts as the one before", () => {
    recordNavigation("/app/feed");
    recordNavigation("/u/ana");
    noteBackNavigation();
    recordNavigation("/app/feed");
    expect(canGoBack()).toBe(false);
  });
});
