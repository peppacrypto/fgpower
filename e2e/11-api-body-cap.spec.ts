import { test, expect } from "@playwright/test";

/**
 * A-045: an anonymous oversized POST to /api is rejected with 413 by the proxy
 * before the handler parses it (previously it was buffered, parsed, then 401).
 * A small post is unaffected and still reaches the handler (401, no session).
 */

test.describe("A-045 /api body cap", () => {
  test("an oversized anonymous POST is rejected with 413, not parsed", async ({ request }) => {
    // ~400 KB, over the 256 KB cap.
    const huge = "x".repeat(400 * 1024);
    const res = await request.post("/api/workout/sets", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ ops: [], pad: huge }),
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(413);
  });

  test("a small anonymous post still reaches the handler (401, not 413)", async ({ request }) => {
    const res = await request.post("/api/workout/sets", {
      headers: { "content-type": "application/json" },
      data: { ops: [] },
      failOnStatusCode: false,
    });
    // Passed the cap, ran the handler, which rejects the missing session.
    expect(res.status()).toBe(401);
  });
});
