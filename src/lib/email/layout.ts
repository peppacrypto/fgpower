/**
 * The one e-mail layout (login codes, the weekly digest, admin alerts): a
 * 600 px table in the app's light tokens (docs/DESIGN.md), inline styles only (mail
 * clients drop <style>), plus a plain-text mirror of the same lines. Every
 * value is escaped here — templates pass plain strings, never HTML. Pure.
 */

const INK = "#17201b";
const MUTED = "#5e6a63";
const BG = "#f7f8f6";
const SURFACE = "#ffffff";
const BORDER = "#e1e6e1";
const ACCENT = "#246b4a";
const CTA_BG = "#246b4a";
const CTA_INK = "#ffffff";
const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
/** The small line above a title or section (the app's `.eyebrow`). */
const EYEBROW = `font-family:${SANS};font-size:13px;font-weight:500`;

export type EmailBlock =
  /** A section head ("Semana passada"). */
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; muted?: boolean; strong?: boolean }
  /** A code to type, large and spaced ("482 913"). */
  | { type: "code"; text: string }
  /** Short lines, one per item. */
  | { type: "list"; items: string[] };

export interface EmailLink {
  label: string;
  /** Absolute http(s) or mailto URL (lib/app-origin.ts appUrl). */
  href: string;
}

export interface EmailContent {
  /** Hidden preview text most clients show next to the subject. */
  preheader?: string;
  /** Small line above the title ("FGPOWER · Resumo semanal · seg 29 set"). */
  kicker: string;
  title: string;
  blocks: EmailBlock[];
  /** The one button. */
  cta?: EmailLink;
  /** Blocks under the button (the login e-mail's "Ou digite este código no app:" + the code). */
  afterCta?: EmailBlock[];
  /** Small print: why they get it, and links (unsubscribe, preferences). */
  footer: { lines: string[]; links?: EmailLink[] };
}

/** HTML-escapes a value for text and attribute positions. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only absolute http(s) and mailto links make it into an e-mail. */
function safeHref(href: string): string {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.toString() : "#";
  } catch {
    return "#";
  }
}

function blockHtml(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      return `<tr><td style="padding:24px 0 6px"><div style="font-family:${SANS};font-size:16px;font-weight:600;color:${INK};border-bottom:1px solid ${BORDER};padding-bottom:8px">${esc(block.text)}</div></td></tr>`;
    case "paragraph":
      return `<tr><td style="padding:6px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${block.muted ? MUTED : INK}${block.strong ? ";font-weight:700" : ""}">${esc(block.text)}</td></tr>`;
    case "code":
      return `<tr><td style="padding:12px 0"><div style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:.2em;color:${INK}">${esc(block.text)}</div></td></tr>`;
    case "list":
      return block.items
        .map(
          (item) =>
            `<tr><td style="padding:3px 0;font-family:${SANS};font-size:15px;line-height:1.45;color:${INK}">${esc(item)}</td></tr>`,
        )
        .join("");
  }
}

function blockText(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      // Plain text has no weight to set a section apart: capitals do it.
      return `\n${block.text.toUpperCase()}`;
    case "paragraph":
      return block.text;
    case "code":
      return block.text;
    case "list":
      return block.items.join("\n");
  }
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const cta = content.cta
    ? `<tr><td style="padding:24px 0 8px"><a href="${esc(safeHref(content.cta.href))}" style="display:inline-block;background:${CTA_BG};color:${CTA_INK};font-family:${SANS};font-size:15px;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:10px">${esc(content.cta.label)}</a></td></tr>`
    : "";
  const footerLinks = (content.footer.links ?? [])
    .map((l) => `<a href="${esc(safeHref(l.href))}" style="color:${ACCENT};text-decoration:underline">${esc(l.label)}</a>`)
    .join(" · ");
  const footer = [
    ...content.footer.lines.map((line) => `<div>${esc(line)}</div>`),
    footerLinks ? `<div style="margin-top:6px">${footerLinks}</div>` : "",
    `<div style="margin-top:10px;${EYEBROW};color:${MUTED}">FGPOWER · fgpower.monster</div>`,
  ].join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG}">
${content.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(content.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${SURFACE};border:1px solid ${BORDER};border-radius:14px">
<tr><td style="padding:28px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${EYEBROW};color:${MUTED}">${esc(content.kicker)}</td></tr>
<tr><td style="padding-top:6px;font-family:${SANS};font-size:24px;line-height:1.25;font-weight:600;color:${INK}">${esc(content.title)}</td></tr>
${content.blocks.map(blockHtml).join("\n")}
${cta}
${(content.afterCta ?? []).map(blockHtml).join("\n")}
<tr><td style="padding-top:28px;border-top:1px solid ${BORDER};font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED}">${footer}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    content.kicker,
    content.title,
    "",
    ...content.blocks.map(blockText),
    ...(content.cta ? ["", `${content.cta.label}: ${safeHref(content.cta.href)}`] : []),
    ...(content.afterCta?.length ? ["", ...content.afterCta.map(blockText)] : []),
    "",
    "—",
    ...content.footer.lines,
    ...(content.footer.links ?? []).map((l) => `${l.label}: ${safeHref(l.href)}`),
    "FGPOWER · fgpower.monster",
  ].join("\n");

  return { html, text };
}
