/** Minimal, dependency-free renderer for the small subset of markdown used in our own authored content (paragraphs + **bold**). Not a general markdown parser — do not feed it untrusted input. */
export function Markdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-3 text-sm text-foreground/90">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={j}>{chunk.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{chunk}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
