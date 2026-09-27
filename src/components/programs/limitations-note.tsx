/**
 * Echoes the limitations the user typed in onboarding ("evitar agachamento
 * profundo por causa do joelho") where they choose and read a plan, with the
 * way to act on it. It only repeats what they said: it doesn't judge which
 * exercises are safe for them.
 */
export function LimitationsNote({ text, fix }: { text: string; fix: React.ReactNode }) {
  return (
    <aside aria-label="Suas limitações" className="mt-8 border-l-2 border-l-warning bg-warning-soft px-3.5 py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-warning">Você informou</p>
      <p className="mt-1 text-sm leading-snug wrap-break-word">“{text}”</p>
      <p className="mt-1.5 text-xs leading-snug text-foreground/75">
        {fix} A FGPOWER não é um serviço de diagnóstico médico. Para lesões, consulte um profissional de saúde.
      </p>
    </aside>
  );
}
