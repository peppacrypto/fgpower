import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

/**
 * A-045: the proxy caps /api request bodies before any handler reads or parses
 * them and before the optimistic session check. A body-bearing /api request
 * must declare a Content-Length (411 otherwise) and stay at or under 256 KB
 * (413 otherwise); small JSON posts, bodyless methods and non-/api routes are
 * untouched.
 */

const apiReq = (init: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest("http://localhost/api/workout/sets", init);

describe("proxy /api body cap (A-045)", () => {
  it("rejects an oversized Content-Length with 413", async () => {
    const res = await proxy(
      apiReq({ method: "POST", headers: { "content-length": String(13_000_000) } }),
    );
    expect(res.status).toBe(413);
  });

  it("rejects a body-bearing /api request with no Content-Length with 411", async () => {
    const res = await proxy(apiReq({ method: "POST" }));
    expect(res.status).toBe(411);
  });

  it("rejects a non-numeric Content-Length with 411", async () => {
    const res = await proxy(
      apiReq({ method: "POST", headers: { "content-length": "not-a-number" } }),
    );
    expect(res.status).toBe(411);
  });

  it("lets a small JSON post through to the route handler", async () => {
    const body = JSON.stringify({ ops: [] });
    const res = await proxy(
      apiReq({
        method: "POST",
        headers: {
          "content-length": String(Buffer.byteLength(body)),
          "content-type": "application/json",
        },
        body,
      }),
    );
    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(411);
    // NextResponse.next(): forwarded to the handler, not answered here.
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("ignores a bodyless method even with a large Content-Length header", async () => {
    const res = await proxy(
      apiReq({ method: "GET", headers: { "content-length": String(13_000_000) } }),
    );
    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(411);
  });

  it("does not cap non-/api routes (an /app server-action POST is untouched)", async () => {
    const res = await proxy(
      new NextRequest("http://localhost/app/today", {
        method: "POST",
        headers: { "next-action": "x" },
      }),
    );
    expect(res.status).not.toBe(413);
    expect(res.status).not.toBe(411);
  });
});
