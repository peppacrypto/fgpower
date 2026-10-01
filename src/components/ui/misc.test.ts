import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "./misc";

/**
 * Avatar draws a stored User.image only when it is a Google account photo:
 * every viewer's browser fetches it (feed, /u signed out, lists, the admin
 * queue), so any other URL would be an IP-logging pixel. Those draw the
 * initials instead.
 */

const render = (src: string | null | undefined) => renderToStaticMarkup(createElement(Avatar, { src, name: "Ana Souza" }));

describe("Avatar", () => {
  it("draws a Google account photo", () => {
    const html = render("https://lh3.googleusercontent.com/a/ACg8ocJx=s96-c");
    expect(html).toContain('<img src="https://lh3.googleusercontent.com/a/ACg8ocJx=s96-c"');
    expect(html).toContain('alt="Ana Souza"');
  });

  it.each([
    ["a tracking pixel on another host", "http://127.0.0.1:9/tracker.png?who=viewer"],
    ["another https host", "https://evil.example/p.png"],
    ["Google's host as a subdomain of another", "https://lh3.googleusercontent.com.evil.example/p.png"],
    ["credentials before Google's host", "https://evil.example@lh3.googleusercontent.com/p.png"],
    ["a port on Google's host", "https://lh3.googleusercontent.com:8443/p.png"],
    ["plain http", "http://lh3.googleusercontent.com/a/x"],
    ["a script URL", "javascript:alert(1)"],
    ["a protocol-relative URL", "//lh3.googleusercontent.com/a/x"],
    ["not a URL", "Ana"],
    ["nothing", null],
    ["an empty string", ""],
  ])("draws the initials for %s", (_label, src) => {
    const html = render(src);
    expect(html).not.toContain("<img");
    expect(html).toContain(">AS</div>");
  });
});
