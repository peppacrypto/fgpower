import { describe, expect, it } from "vitest";
import { startOfWeek } from "./week";

describe("startOfWeek (America/Sao_Paulo)", () => {
  it("returns Monday 00:00 São Paulo (03:00 UTC) for a mid-week instant", () => {
    expect(startOfWeek(new Date("2026-09-25T12:00:00Z")).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("keeps Sunday late evening in the week that is ending, though UTC is already Monday", () => {
    // Sunday 27/09 23:30 in São Paulo = Monday 02:30 UTC.
    expect(startOfWeek(new Date("2026-09-28T02:30:00Z")).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("starts a new week at Monday 00:00 São Paulo", () => {
    expect(startOfWeek(new Date("2026-09-28T03:00:00Z")).toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("handles a Monday instant itself and other zones", () => {
    expect(startOfWeek(new Date("2026-09-21T10:00:00Z"), "UTC").toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});
