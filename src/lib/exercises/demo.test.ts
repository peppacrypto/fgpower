import { describe, expect, it } from "vitest";
import { exerciseMediaParts, isVideoUrl } from "./demo";

const m = (kind: string, url: string) => ({ kind, url });

describe("exerciseMediaParts", () => {
  it("leaves a catalog photo pair as frames, with no demo", () => {
    const parts = exerciseMediaParts([m("IMAGE_START", "/a/0.webp"), m("IMAGE_END", "/a/1.webp")]);
    expect(parts.demo).toBeNull();
    expect(parts.frames.map((f) => f.kind)).toEqual(["IMAGE_START", "IMAGE_END"]);
  });

  it("separates the loop from the frames and keeps Início before Fim", () => {
    const parts = exerciseMediaParts([
      m("IMAGE_END", "/a/fig-end.webp"),
      m("IMAGE_START", "/a/fig-start.webp"),
      m("ILLUSTRATION", "/a/fig-loop.webp"),
    ]);
    expect(parts.demo?.url).toBe("/a/fig-loop.webp");
    expect(parts.frames.map((f) => f.kind)).toEqual(["IMAGE_START", "IMAGE_END"]);
  });

  it("uses the thumbnail frame as the still for reduced motion", () => {
    const parts = exerciseMediaParts([
      m("IMAGE_END", "/a/fig-end.webp"),
      m("IMAGE_START", "/a/fig-start.webp"),
      m("ILLUSTRATION", "/a/fig-loop.webp"),
    ]);
    expect(parts.still?.url).toBe("/a/fig-end.webp");
  });

  it("does not repeat a hold's single picture as a frame", () => {
    const parts = exerciseMediaParts([m("IMAGE_START", "/a/fig-start.webp"), m("ILLUSTRATION", "/a/fig-start.webp")]);
    expect(parts.demo?.url).toBe("/a/fig-start.webp");
    expect(parts.frames).toEqual([]);
  });

  it("handles an exercise with no media", () => {
    expect(exerciseMediaParts([])).toEqual({ demo: null, still: null, frames: [] });
  });
});

describe("isVideoUrl", () => {
  it("tells a video loop from an image", () => {
    expect(isVideoUrl("/exercises/pushups/f2-loop.mp4")).toBe(true);
    expect(isVideoUrl("/exercises/pushups/f2-loop.mp4?v=2")).toBe(true);
    expect(isVideoUrl("/exercises/pushups/fig-loop.webp")).toBe(false);
  });
});
