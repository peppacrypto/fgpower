import { describe, expect, it } from "vitest";
import { formatPct, monoDate, placePoints, sparkPath, summarize, valueScale, type ChartInputPoint } from "./scale";

const NBSP = " ";
const at = (iso: string) => new Date(iso);
const NOW = at("2026-09-27T12:00:00Z");

describe("valueScale", () => {
  it("follows the data instead of starting at 0, on multiples of the load step", () => {
    const s = valueScale([60, 62.5, 65], 2.5);
    expect(s.lo).toBe(55);
    expect(s.hi).toBe(70);
    expect(s.ticks).toEqual([55, 60, 65, 70]);
    for (const t of s.ticks) expect((t / 2.5) % 1).toBe(0);
  });

  it("gives a flat series room above and below", () => {
    const s = valueScale([60, 60, 60], 2.5);
    expect(s.lo).toBeLessThan(60);
    expect(s.hi).toBeGreaterThan(60);
  });

  it("never goes below 0 and handles all-zero series", () => {
    expect(valueScale([1, 2], 1).lo).toBeGreaterThanOrEqual(0);
    const zero = valueScale([0, 0], 2.5);
    expect(zero.lo).toBe(0);
    expect(zero.hi).toBeGreaterThan(0);
  });

  it("keeps at most 3 gaps, with nice ticks for big numbers", () => {
    const s = valueScale([1180, 1640], 10);
    expect(s.ticks.length).toBeLessThanOrEqual(4);
    expect(s.lo).toBeLessThanOrEqual(1180 * 0.95);
    expect(s.hi).toBeGreaterThanOrEqual(1640 * 1.05);
    expect(s.ticks.every((t) => t % 10 === 0)).toBe(true);
  });

  it("uses whole reps for reps", () => {
    const s = valueScale([10, 12], 1);
    expect(s.ticks.every((t) => Number.isInteger(t))).toBe(true);
  });
});

describe("placePoints", () => {
  const scale = { lo: 55, hi: 70, ticks: [55, 60, 65, 70] };
  it("spaces points by time, drops missing values and flags the last", () => {
    const pts: ChartInputPoint[] = [
      { key: "a", date: at("2026-09-01T12:00:00Z"), value: 60 },
      { key: "b", date: at("2026-09-03T12:00:00Z"), value: null },
      { key: "c", date: at("2026-09-11T12:00:00Z"), value: 65, record: true },
    ];
    const placed = placePoints(pts, scale);
    expect(placed.map((p) => p.key)).toEqual(["a", "c"]);
    expect(placed[0].x).toBe(0);
    expect(placed[1].x).toBe(100);
    expect(placed[1].last).toBe(true);
    expect(placed[1].record).toBe(true);
    expect(placed[0].y).toBeCloseTo((1 - 5 / 15) * 100);
  });

  it("centers a single point", () => {
    const [p] = placePoints([{ key: "a", date: at("2026-09-01T12:00:00Z"), value: 60 }], scale);
    expect(p.x).toBe(50);
  });
});

describe("summarize", () => {
  const scale = { lo: 55, hi: 70, ticks: [] };
  it("reads '60 → 65 kg · +5 kg (+8%)' since the first date", () => {
    const placed = placePoints(
      [
        { key: "a", date: at("2026-09-07T15:00:00Z"), value: 60 },
        { key: "b", date: at("2026-09-21T15:00:00Z"), value: 65 },
      ],
      scale,
    );
    const s = summarize("Melhor carga por sessão", placed, "kg", NOW);
    expect(s.headline).toBe(`60 → 65${NBSP}kg · +5${NBSP}kg (+8%)`);
    expect(s.since).toBe("desde 07 SET");
    expect(s.ariaLabel).toBe(
      `Melhor carga por sessão: de 60${NBSP}kg para 65${NBSP}kg entre 07/09 e 21/09, em 2 sessões.`,
    );
  });

  it("uses a true minus for drops and names a higher peak", () => {
    const placed = placePoints(
      [
        { key: "a", date: at("2026-09-07T15:00:00Z"), value: 12 },
        { key: "b", date: at("2026-09-14T15:00:00Z"), value: 14 },
        { key: "c", date: at("2026-09-21T15:00:00Z"), value: 11 },
      ],
      { lo: 10, hi: 15, ticks: [] },
    );
    const s = summarize("Mais reps por sessão", placed, "reps");
    expect(s.headline).toBe("12 → 11 reps · −1 rep (−8%)");
    expect(s.ariaLabel).toContain("máxima 14 reps");
  });

  it("says 'mesma marca' when nothing changed and handles one point", () => {
    const two = placePoints(
      [
        { key: "a", date: at("2026-09-07T15:00:00Z"), value: 30 },
        { key: "b", date: at("2026-09-21T15:00:00Z"), value: 30 },
      ],
      { lo: 25, hi: 35, ticks: [] },
    );
    expect(summarize("Tempo", two, "seconds").headline).toBe(`30 → 30${NBSP}s · mesma marca`);
    const one = placePoints([{ key: "a", date: at("2026-09-07T15:00:00Z"), value: 30 }], { lo: 25, hi: 35, ticks: [] });
    expect(summarize("Tempo", one, "seconds", NOW)).toMatchObject({ headline: `30${NBSP}s`, since: "em 07 SET" });
  });

  it("uses the São Paulo day for dates (an evening workout is not tomorrow)", () => {
    // 21/09 22:30 in São Paulo = 22/09 01:30 UTC.
    expect(monoDate(at("2026-09-22T01:30:00Z"), at("2026-09-27T12:00:00Z"))).toBe("21 SET");
  });

  it("adds the year to a date from another year", () => {
    expect(monoDate(at("2025-09-22T15:00:00Z"), at("2026-09-27T12:00:00Z"))).toBe("22 SET 2025");
  });
});

describe("formatPct / sparkPath", () => {
  it("rounds to whole signed percents", () => {
    expect(formatPct(60, 65)).toBe("+8%");
    expect(formatPct(65, 60)).toBe("−8%");
    expect(formatPct(0, 5)).toBeNull();
  });

  it("draws a sparkline inside its box", () => {
    const p = sparkPath([1, 3, 2], 60, 20)!;
    expect(p.points.split(" ")).toHaveLength(3);
    expect(p.last[0]).toBe(57);
    expect(sparkPath([], 60, 20)).toBeNull();
    expect(sparkPath([5, 5], 60, 20)!.last[1]).toBe(10);
  });
});
