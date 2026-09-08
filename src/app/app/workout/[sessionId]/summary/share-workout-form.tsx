"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { shareWorkoutSession } from "@/lib/actions/activities";

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "Privado" },
  { value: "FOLLOWERS", label: "Seguidores" },
  { value: "PUBLIC", label: "Público" },
] as const;

export function ShareWorkoutForm({
  sessionId,
  initialVisibility,
  initialShowDetailedLoads,
  initialCaption,
}: {
  sessionId: string;
  initialVisibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
  initialShowDetailedLoads: boolean;
  initialCaption: string;
}) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [showDetailedLoads, setShowDetailedLoads] = useState(initialShowDetailedLoads);
  const [caption, setCaption] = useState(initialCaption);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        {VISIBILITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setVisibility(opt.value);
              setSaved(false);
            }}
            className={
              visibility === opt.value
                ? "flex-1 rounded-[var(--radius-sm)] border border-accent bg-accent-soft py-2 text-sm font-semibold text-accent"
                : "flex-1 rounded-[var(--radius-sm)] border border-border py-2 text-sm text-muted hover:bg-surface-2"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {visibility !== "PRIVATE" ? (
        <>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showDetailedLoads}
              onChange={(e) => {
                setShowDetailedLoads(e.target.checked);
                setSaved(false);
              }}
              className="size-4 accent-accent"
            />
            Mostrar cargas para quem ver este treino
          </label>

          <Textarea
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              setSaved(false);
            }}
            placeholder="Adicione um comentário (opcional)"
            maxLength={280}
            rows={2}
          />
        </>
      ) : null}

      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await shareWorkoutSession({ sessionId, visibility, showDetailedLoads, caption });
            setSaved(true);
          })
        }
      >
        {pending ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}
      </Button>
    </div>
  );
}
