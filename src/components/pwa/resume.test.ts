import { describe, expect, it } from "vitest";
import {
  isLiveWorkoutPath,
  isNetworkError,
  isWorkoutFocusPath,
  RESUME_REFRESH_AFTER_MS,
  shouldRefreshOnResume,
} from "./resume";

// São Paulo is UTC−3 (no DST since 2019).
const sp = (iso: string) => Date.parse(`${iso}-03:00`);

describe("shouldRefreshOnResume", () => {
  it("keeps a short background trip on the same page", () => {
    expect(shouldRefreshOnResume(sp("2026-09-26T10:00:00"), sp("2026-09-26T10:04:59"))).toBe(false);
  });

  it("refreshes after more than five minutes away", () => {
    const hidden = sp("2026-09-26T10:00:00");
    expect(shouldRefreshOnResume(hidden, hidden + RESUME_REFRESH_AFTER_MS + 1)).toBe(true);
  });

  it("refreshes when the São Paulo day turned over, even after a minute", () => {
    expect(shouldRefreshOnResume(sp("2026-09-26T23:59:30"), sp("2026-09-27T00:00:30"))).toBe(true);
  });

  it("uses the São Paulo day, not UTC", () => {
    // 21:00 in São Paulo is UTC midnight: a UTC-based check would call this a new day.
    expect(shouldRefreshOnResume(sp("2026-09-26T20:59:00"), sp("2026-09-26T21:02:00"))).toBe(false);
  });
});

describe("isLiveWorkoutPath", () => {
  it("matches the workout screen and its summary, nothing else", () => {
    expect(isLiveWorkoutPath("/app/workout/abc")).toBe(true);
    expect(isLiveWorkoutPath("/app/workout/abc/summary")).toBe(true);
    expect(isLiveWorkoutPath("/app/today")).toBe(false);
    expect(isLiveWorkoutPath("/app/workouts")).toBe(false);
  });
});

describe("isWorkoutFocusPath", () => {
  it("is the workout screen only: the summary keeps the nav", () => {
    expect(isWorkoutFocusPath("/app/workout/abc")).toBe(true);
    expect(isWorkoutFocusPath("/app/workout/abc/summary")).toBe(false);
    expect(isWorkoutFocusPath("/app/today")).toBe(false);
  });
});

describe("isNetworkError", () => {
  it("treats any failure while offline as connectivity", () => {
    expect(isNetworkError(new Error("boom"), false)).toBe(true);
  });

  it("recognises the browsers' fetch-failure TypeErrors", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"), true)).toBe(true); // Chrome
    expect(isNetworkError(new TypeError("Load failed"), true)).toBe(true); // Safari
    expect(isNetworkError(new TypeError("NetworkError when attempting to fetch resource."), true)).toBe(true); // Firefox
  });

  it("keeps real errors as real errors", () => {
    expect(isNetworkError(new Error("An error occurred in the Server Components render."), true)).toBe(false);
    expect(isNetworkError(new TypeError("Cannot read properties of undefined"), true)).toBe(false);
    expect(isNetworkError("nope", true)).toBe(false);
  });
});
