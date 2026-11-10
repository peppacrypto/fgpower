import { describe, expect, it } from "vitest";
import { MIN_LEAD_MS, restAlertHintKind, restAlertNext, restAlertStep, type PlannedAlert } from "./rest-notification";

const NOW = 1_000_000;
const timer = (o: Partial<{ id: number; endsAt: number; pausedLeftMs: number | null; kind: "rest" | "transition" }> = {}) => ({
  id: 1,
  endsAt: NOW + 90_000,
  pausedLeftMs: null,
  kind: "rest" as const,
  ...o,
});
const sent = (o: Partial<PlannedAlert> = {}): PlannedAlert => ({
  restId: 1,
  endsAt: NOW + 90_000,
  kind: "rest",
  next: "Série 2 · Supino",
  ...o,
});

describe("restAlertStep", () => {
  it("schedules a rest as it starts, and nothing more while it is unchanged", () => {
    expect(restAlertStep(null, timer(), "Série 2 · Supino", NOW)).toEqual({ do: "schedule", alert: sent() });
    expect(restAlertStep(sent(), timer(), "Série 2 · Supino", NOW + 5000)).toEqual({ do: "none" });
  });

  it("replaces it when the end moves (±15 s), the next set changes or another set's rest starts", () => {
    expect(restAlertStep(sent(), timer({ endsAt: NOW + 105_000 }), "Série 2 · Supino", NOW)).toMatchObject({ do: "schedule" });
    expect(restAlertStep(sent(), timer(), "Série 3 · Supino", NOW)).toMatchObject({ do: "schedule" });
    expect(restAlertStep(sent(), timer({ id: 2 }), "Série 2 · Supino", NOW)).toMatchObject({ do: "schedule" });
  });

  it("takes it back when the rest is skipped or paused, and forgets one already due", () => {
    expect(restAlertStep(sent(), null, null, NOW)).toEqual({ do: "cancel" });
    expect(restAlertStep(sent(), timer({ pausedLeftMs: 40_000 }), "Série 2 · Supino", NOW)).toEqual({ do: "cancel" });
    expect(restAlertStep(sent(), null, null, NOW + 90_000)).toEqual({ do: "forget" });
    // The bar showing "Descanso concluído": the notification is on its way.
    expect(restAlertStep(sent(), timer(), "Série 2 · Supino", NOW + 91_000)).toEqual({ do: "forget" });
    expect(restAlertStep(null, null, null, NOW)).toEqual({ do: "none" });
  });

  it("in a rest's last seconds keeps the one due now and schedules nothing new", () => {
    const end = NOW + MIN_LEAD_MS - 1;
    expect(restAlertStep(null, timer({ endsAt: end }), "x", NOW)).toEqual({ do: "none" });
    expect(restAlertStep(sent({ endsAt: end }), timer({ endsAt: end }), "y", NOW)).toEqual({ do: "none" });
    // Cut down to its last seconds with −15 s: the later one is taken back (the page cues this one).
    expect(restAlertStep(sent(), timer({ endsAt: end }), "Série 2 · Supino", NOW)).toEqual({ do: "cancel" });
  });
});

describe("restAlertNext", () => {
  it("names the next set, else the next exercise, never a load", () => {
    expect(restAlertNext({ set: "Série 2", exercise: "Supino reto", nextExercise: "Remada" })).toBe("Série 2 · Supino reto");
    expect(restAlertNext({ set: null, exercise: "Supino reto", nextExercise: "Remada baixa" })).toBe(
      "Próximo exercício: Remada baixa",
    );
    expect(restAlertNext({ set: null, exercise: "Supino reto", nextExercise: null })).toBeNull();
  });
});

describe("restAlertHintKind", () => {
  const iphone = { soundUnreliable: true, device: "none" as const };
  it("on an iPhone browser: install to the home screen first", () => {
    expect(restAlertHintKind({ ...iphone, support: "ios-needs-install" })).toBe("install");
  });
  it("installed but not on: turn notifications on; blocked: unblock them", () => {
    expect(restAlertHintKind({ ...iphone, support: "default" })).toBe("enable");
    expect(restAlertHintKind({ ...iphone, support: "granted" })).toBe("enable");
    expect(restAlertHintKind({ ...iphone, support: "denied" })).toBe("blocked");
  });
  it("nothing once it works, while unknown, where nothing can be done, or where the beep works", () => {
    expect(restAlertHintKind({ ...iphone, support: "granted", device: "subscribed" })).toBeNull();
    expect(restAlertHintKind({ ...iphone, support: "granted", device: "unknown" })).toBeNull();
    expect(restAlertHintKind({ ...iphone, support: "unsupported" })).toBeNull();
    expect(restAlertHintKind({ ...iphone, support: null })).toBeNull();
    expect(restAlertHintKind({ soundUnreliable: false, support: "default", device: "none" })).toBeNull();
  });
});
