import { describe, expect, it } from "vitest";
import { ProfileOgCard } from "./profile-card";
import type { WorkoutImageData } from "./workout-images";
import { StoryImage, WorkoutOgCard } from "./workout-images";

/**
 * GHSA-vcvr-r3jv-pc5j (next/og): the advisory is exploitable only when
 * user-controlled data reaches an SVG attribute, a CSS/`style` value, or an
 * inline <svg> built from user data. Our share cards stay safe by passing
 * every user string as ELEMENT TEXT ONLY (Satori rasterizes it to glyph
 * paths) and building every `style`/attribute from static tokens. This test
 * locks that invariant: if a refactor ever routes user text into `style`, a
 * non-`children` prop, or an inline <svg>/<image>, it fails.
 */

// A string no template literal in the cards would ever produce on its own.
// Kept <= 24 chars so it survives every in-component truncation (ProfileOgCard
// truncates program to 30, name to 40 via truncate()) — otherwise the leak and
// presence assertions would pass vacuously for a truncated field (A-041 verify).
const EVIL = "PWN7f3a</style><svg x>";

type El = { type: unknown; props: Record<string, unknown> };

function isElement(node: unknown): node is El {
  return typeof node === "object" && node !== null && "props" in node && "type" in node;
}

/**
 * Resolve a function-component element to its rendered output — this is what
 * next/og (Satori) actually rasterizes. We inspect the RENDERED host elements,
 * not the authored tree: inspecting the authored tree would both miss a leak
 * that happens inside a child component AND falsely flag a user string passed
 * as a prop to a component that consumes it safely (e.g. a name reduced to
 * initials). Host elements (string type) and fragments pass straight through.
 */
function render(node: unknown): unknown {
  if (isElement(node) && typeof node.type === "function") {
    return render((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return node;
}

function walk(node: unknown, visit: (el: El) => void): void {
  const resolved = render(node);
  if (Array.isArray(resolved)) {
    for (const child of resolved) walk(child, visit);
    return;
  }
  if (!isElement(resolved)) return;
  visit(resolved);
  walk(resolved.props.children, visit);
}

/** Collects every leaf string/number the rendered tree draws as text. */
function textContent(root: unknown): string {
  const parts: string[] = [];
  const collect = (node: unknown) => {
    const resolved = render(node);
    if (Array.isArray(resolved)) {
      for (const child of resolved) collect(child);
      return;
    }
    if (typeof resolved === "string" || typeof resolved === "number") {
      parts.push(String(resolved));
      return;
    }
    if (isElement(resolved)) collect(resolved.props.children);
  };
  collect(root);
  return parts.join("\u0000");
}

const TILE = "data:image/png;base64,AAAA"; // brand asset, never user data

function profileCard() {
  return ProfileOgCard({
    tile: TILE,
    data: {
      name: EVIL,
      username: EVIL,
      bio: EVIL,
      followers: 3,
      following: 4,
      program: EVIL,
      isPrivate: true,
      avatar: null, // force the initials path; a real avatar is a server-fetched data URI
    },
  });
}

const workoutData: WorkoutImageData = {
  workoutName: EVIL,
  date: EVIL,
  ordinal: 42,
  milestone: true,
  stats: [{ label: EVIL, value: EVIL }],
  records: [{ name: EVIL, text: EVIL }],
  exercises: [{ name: EVIL, line: EVIL }],
  author: { name: EVIL, username: EVIL },
  caption: EVIL,
};

const cards: Array<[string, () => unknown]> = [
  ["ProfileOgCard", profileCard],
  ["WorkoutOgCard", () => WorkoutOgCard({ data: workoutData, tile: TILE })],
  ["StoryImage", () => StoryImage({ data: workoutData, tile: TILE })],
];

describe("og share cards keep user data out of styles, attributes and SVG", () => {
  for (const [name, build] of cards) {
    describe(name, () => {
      const tree = build();

      it("never puts user data in a `style` object or a non-text attribute", () => {
        walk(tree, (el) => {
          for (const [prop, value] of Object.entries(el.props)) {
            if (prop === "children") continue;
            expect(
              JSON.stringify(value) ?? "",
              `user data leaked into prop "${prop}" of <${String(el.type)}>`,
            ).not.toContain(EVIL);
          }
        });
      });

      it("renders no inline svg/image/foreignObject element", () => {
        walk(tree, (el) => {
          expect(["svg", "image", "foreignObject"]).not.toContain(el.type);
        });
      });

      it("does render the user data as text (fixtures stay meaningful)", () => {
        expect(textContent(tree)).toContain(EVIL);
      });
    });
  }
});
