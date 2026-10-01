/**
 * The one e-mail layout (login codes, the weekly digest, admin alerts): a
 * 600 px table in the Dossiê's light tokens, inline styles only (mail
 * clients drop <style>), plus a plain-text mirror of the same lines. Every
 * value is escaped here — templates pass plain strings, never HTML. Pure.
 */

const INK = "#1c1d1f";
const MUTED = "#5c6672";
const BG = "#fafafb";
const SURFACE = "#ffffff";
const ACCENT = "#4d6a06";
const CTA_BG = "#b4e600";
const CTA_INK = "#14210a";
const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const MICRO_CAPS = `font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase`;

export type EmailBlock =
  /** A section head: mono micro-caps over a 2px rule ("SEMANA PASSADA"). */
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
  /** Mono line above the title ("FGPOWER · RESUMO SEMANAL · SEG 29 SET"). */
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
      return `<tr><td style="padding:24px 0 8px"><div style="${MICRO_CAPS};color:${INK};border-bottom:2px solid ${INK};padding-bottom:6px">${esc(block.text)}</div></td></tr>`;
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
    ? `<tr><td style="padding:24px 0 8px"><a href="${esc(safeHref(content.cta.href))}" style="display:inline-block;background:${CTA_BG};color:${CTA_INK};font-family:${SANS};font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px;border:2px solid ${CTA_INK}">${esc(content.cta.label)}</a></td></tr>`
    : "";
  const footerLinks = (content.footer.links ?? [])
    .map((l) => `<a href="${esc(safeHref(l.href))}" style="color:${ACCENT};text-decoration:underline">${esc(l.label)}</a>`)
    .join(" · ");
  const footer = [
    ...content.footer.lines.map((line) => `<div>${esc(line)}</div>`),
    footerLinks ? `<div style="margin-top:6px">${footerLinks}</div>` : "",
    `<div style="margin-top:10px;${MICRO_CAPS};color:${MUTED}">FGPOWER · fgpower.monster</div>`,
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
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${SURFACE};border:1px solid #d9dce1">
<tr><td style="padding:28px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${MICRO_CAPS};color:${ACCENT}">${esc(content.kicker)}</td></tr>
<tr><td style="padding-top:8px;font-family:${SANS};font-size:24px;line-height:1.25;font-weight:800;color:${INK}">${esc(content.title)}</td></tr>
${content.blocks.map(blockHtml).join("\n")}
${cta}
${(content.afterCta ?? []).map(blockHtml).join("\n")}
<tr><td style="padding-top:28px;border-top:1px solid #d9dce1;font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED}">${footer}</td></tr>
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
