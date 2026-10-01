import "client-only";
import { storyPath } from "@/lib/social/share-token";

/**
 * Browser sharing helpers (Web Share with a clipboard fallback). Safari only
 * lets navigator.share / clipboard run inside the tap's user activation, which
 * an awaited fetch or server action can use up — hence the prefetch and the
 * promise-fed clipboard write.
 */

export type ShareOutcome = "shared" | "cancelled" | "needs-gesture" | "unsupported" | "failed";

/** Whether this browser can share an image file (Android Chrome, iOS Safari). */
export function canShareFiles(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] })
    );
  } catch {
    return false;
  }
}

function errorName(err: unknown): string {
  return err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
}

/**
 * Shares an image plus a line of text (the link goes INSIDE `text`: WhatsApp
 * and iOS drop `url` when files are shared). "needs-gesture": Safari refused
 * because the activation was used up — offer a second tap ("Enviar imagem").
 */
export async function shareImageAndLink(p: { file: File; title: string; text: string }): Promise<ShareOutcome> {
  if (!canShareFiles()) return "unsupported";
  try {
    await navigator.share({ files: [p.file], title: p.title, text: p.text });
    return "shared";
  } catch (err) {
    const name = errorName(err);
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-gesture";
    return "failed";
  }
}

/**
 * Copies text that is still being fetched (e.g. a share link the server is
 * minting) without losing Safari's activation: ClipboardItem accepts a
 * promise. Falls back to writeText after the await elsewhere.
 */
export async function copyTextKeepingActivation(text: Promise<string> | string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function") {
      const blob = Promise.resolve(text).then((t) => new Blob([t], { type: "text/plain" }));
      // A write refused before it reads the text would leave the text's failure unhandled.
      blob.catch(() => {});
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return true;
    }
    await navigator.clipboard.writeText(await text);
    return true;
  } catch {
    return false;
  }
}

/** Saves a blob as a file (the "Baixar imagem" fallback where files can't be shared). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stories = new Map<string, Promise<Blob | null>>();

/**
 * The story image of a shared workout, fetched once per token + version (the
 * activity's updatedAt), so a later tap can share it synchronously.
 */
export function prefetchStory(token: string, version: number | string): Promise<Blob | null> {
  const key = `${token}:${version}`;
  let pending = stories.get(key);
  if (!pending) {
    pending = fetch(storyPath(token, version), { credentials: "same-origin" })
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null);
    stories.set(key, pending);
    // A failure is retried on the next ask.
    void pending.then((blob) => {
      if (!blob) stories.delete(key);
    });
  }
  return pending;
}

/**
 * Shares a link (Web Share where there is one), else copies it. "copied" /
 * "failed" come from the clipboard fallback.
 */
export async function shareLink(p: { title: string; text: string; url: string }): Promise<ShareOutcome | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: p.title, text: p.text, url: p.url });
      return "shared";
    } catch (err) {
      if (errorName(err) === "AbortError") return "cancelled";
      // Refused or unavailable here: copy instead.
    }
  }
  return (await copyTextKeepingActivation(p.url)) ? "copied" : "failed";
}
