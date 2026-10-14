/**
 * Echoes the limitations the user typed in onboarding ("evitar agachamento
 * profundo por causa do joelho") where they choose and read a plan, with the
 * way to act on it. It only repeats what they said: it doesn't judge which
 * exercises are safe for them.
 */
export function LimitationsNote({ text, fix }: { text: string; fix: React.ReactNode }) {
  return (
    <aside aria-label="Suas limitações" className="mt-6 rounded-[var(--radius-lg)] bg-warning-soft px-4 py-3.5">
      <p className="tag tag--status tag--warn text-[13px] font-semibold">Você informou</p>
      <p className="mt-1.5 text-[15px] leading-snug wrap-break-word">“{text}”</p>
      <p className="mt-1.5 text-[13px] leading-snug text-foreground/80">
        {fix} A FGPOWER não é um serviço de diagnóstico médico. Para lesões, consulte um profissional de saúde.
      </p>
    </aside>
  );
}
