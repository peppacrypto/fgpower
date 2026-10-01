"use client";

/**
 * An inline script that runs as the HTML is parsed (the server's copy) and is
 * inert once React renders it on the client: React never runs the scripts it
 * renders, and warns about an executable one ("Encountered a script tag…").
 * The server's copy is `text/javascript`; the client's is `text/plain`, a
 * data block, and suppressHydrationWarning keeps the DOM's own type. As in
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
