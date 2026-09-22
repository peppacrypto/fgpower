import { Fragment } from "react";

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
      continue;
    }
    // "* " needs the space, so a line opening with **bold** is not a bullet.
    const item = /^[-*]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push(item[1]);
      continue;
    }
    if (list && /^\s/.test(raw)) {
      // indented continuation of the previous list item
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).map((chunk, i) => {
        if (chunk.length > 4 && chunk.startsWith("**") && chunk.endsWith("**")) {
          return <strong key={i}>{chunk.slice(2, -2)}</strong>;
        }
        if (chunk.length > 2 && chunk.startsWith("*") && chunk.endsWith("*")) {
          return <em key={i}>{chunk.slice(1, -1)}</em>;
        }
        return <Fragment key={i}>{chunk}</Fragment>;
      })}
    </>
  );
}

/** Minimal, dependency-free renderer for the subset of markdown used in our own authored content: paragraphs, #-headings, "-" / "1." lists, **bold** and *italic*. Not a general markdown parser — do not feed it untrusted input. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-foreground/90">
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "h") {
          return block.level <= 3 ? (
            <h3 key={i} className="mt-3 text-base font-bold text-foreground">
              <Inline text={block.text} />
            </h3>
          ) : (
            <h4 key={i} className="mt-2 text-sm font-bold text-foreground">
              <Inline text={block.text} />
            </h4>
          );
        }
        if ("items" in block) {
          const List = block.kind;
          return (
            <List key={i} className={`flex flex-col gap-1.5 pl-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
