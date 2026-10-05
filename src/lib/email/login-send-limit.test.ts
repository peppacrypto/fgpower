import { beforeEach, describe, expect, it } from "vitest";
import { allowLoginCodeSend, clientIp, resetLoginSendLimit } from "./login-send-limit";

const MINUTE = 60_000;

beforeEach(resetLoginSendLimit);

describe("clientIp", () => {
  it("takes the leftmost x-forwarded-for, then x-real-ip, then local", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("local");
    expect(clientIp(undefined)).toBe("local");
  });
});

describe("allowLoginCodeSend", () => {
  it("caps a client IP at 5 sends a minute (fresh addresses, so only the IP cap bites)", () => {
    for (let k = 0; k < 5; k++) expect(allowLoginCodeSend({ ip: "1.1.1.1", email: `b${k}@x.co` }, 1000)).toBe("ok");
    expect(allowLoginCodeSend({ ip: "1.1.1.1", email: "b6@x.co" }, 1000)).toBe("ip");
    // Another IP has its own minute budget.
    expect(allowLoginCodeSend({ ip: "2.2.2.2", email: "b6@x.co" }, 1000)).toBe("ok");
  });

  it("caps a client IP at 30 sends a rolling day (5 a minute across six minutes, then refused)", () => {
    for (let m = 0; m < 6; m++) {
      for (let k = 0; k < 5; k++) {
        expect(allowLoginCodeSend({ ip: "9.9.9.9", email: `u${m}-${k}@x.co` }, m * MINUTE)).toBe("ok");
      }
    }
    expect(allowLoginCodeSend({ ip: "9.9.9.9", email: "u6@x.co" }, 6 * MINUTE)).toBe("ip");
  });

  it("caps one address at 3 sends a minute (case-insensitive), as the per-account dimension", () => {
    for (let k = 0; k < 3; k++) expect(allowLoginCodeSend({ ip: "3.3.3.3", email: "Same@x.co" }, 2000)).toBe("ok");
    expect(allowLoginCodeSend({ ip: "3.3.3.3", email: "same@x.co" }, 2000)).toBe("address");
    // A different address from the same IP is still fine (under the per-IP minute cap).
    expect(allowLoginCodeSend({ ip: "3.3.3.3", email: "other@x.co" }, 2000)).toBe("ok");
  });

  it("forgets a window once it has passed", () => {
    for (let k = 0; k < 5; k++) allowLoginCodeSend({ ip: "4.4.4.4", email: `w${k}@x.co` }, 0);
    expect(allowLoginCodeSend({ ip: "4.4.4.4", email: "w6@x.co" }, 0)).toBe("ip");
    expect(allowLoginCodeSend({ ip: "4.4.4.4", email: "w6@x.co" }, MINUTE + 1)).toBe("ok");
  });
});
