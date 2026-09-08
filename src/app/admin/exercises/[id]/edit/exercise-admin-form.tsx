"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { updateExerciseAdmin, linkExerciseEvidence, unlinkExerciseEvidence, type ExerciseAdminUpdate } from "@/lib/actions/admin";

interface EvidenceLink {
  sourceId: string;
  key: string;
  title: string;
  notePt: string | null;
}

export function ExerciseAdminForm({
  exerciseId,
  initial,
  evidenceLinks,
}: {
  exerciseId: string;
  initial: ExerciseAdminUpdate;
  evidenceLinks: EvidenceLink[];
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [newSourceKey, setNewSourceKey] = useState("");
  const [newSourceNote, setNewSourceNote] = useState("");
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  function set<K extends keyof ExerciseAdminUpdate>(key: K, value: ExerciseAdminUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="namePt">Nome (PT)</Label>
          <Input id="namePt" value={form.namePt} onChange={(e) => set("namePt", e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="nameEn">Nome (EN)</Label>
          <Input id="nameEn" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isCurated} onChange={(e) => set("isCurated", e.target.checked)} className="size-4 accent-accent" />
          Curado (conteúdo detalhado)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="size-4 accent-accent" />
          Publicado
        </label>
      </div>

      <div>
        <Label htmlFor="setupPt">Preparação</Label>
        <Textarea id="setupPt" value={form.setupPt} onChange={(e) => set("setupPt", e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="breathingPt">Respiração</Label>
        <Textarea id="breathingPt" value={form.breathingPt} onChange={(e) => set("breathingPt", e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="coachingCuesPt">Dicas de execução (uma por linha)</Label>
        <Textarea id="coachingCuesPt" value={form.coachingCuesPt} onChange={(e) => set("coachingCuesPt", e.target.value)} rows={4} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="commonMistakesPt">Erros comuns (um por linha)</Label>
        <Textarea id="commonMistakesPt" value={form.commonMistakesPt} onChange={(e) => set("commonMistakesPt", e.target.value)} rows={4} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="rangeOfMotionPt">Amplitude de movimento</Label>
        <Textarea id="rangeOfMotionPt" value={form.rangeOfMotionPt} onChange={(e) => set("rangeOfMotionPt", e.target.value)} rows={2} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="whyThisExerciseExistsPt">Base científica (resumo)</Label>
        <Textarea
          id="whyThisExerciseExistsPt"
          value={form.whyThisExerciseExistsPt}
          onChange={(e) => set("whyThisExerciseExistsPt", e.target.value)}
          rows={3}
          className="mt-1.5"
        />
      </div>

      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateExerciseAdmin(exerciseId, form);
            setSaved(true);
          })
        }
        className="w-fit"
      >
        {pending ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}
      </Button>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Evidência científica vinculada</h3>
        <div className="mt-3 flex flex-col gap-2">
          {evidenceLinks.map((ev) => (
            <div key={ev.sourceId} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-sm">
              <span>
                {ev.title} <span className="text-muted">({ev.key})</span>
              </span>
              <button
                onClick={() => startTransition(() => unlinkExerciseEvidence(exerciseId, ev.sourceId))}
                className="text-xs text-danger hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
          {evidenceLinks.length === 0 ? <p className="text-sm text-muted">Nenhuma fonte vinculada.</p> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="chave da fonte (ex.: schoenfeld-2017-volume-dose-response)"
            value={newSourceKey}
            onChange={(e) => setNewSourceKey(e.target.value)}
          />
          <Input placeholder="nota (opcional)" value={newSourceNote} onChange={(e) => setNewSourceNote(e.target.value)} />
          <Button
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                setEvidenceError(null);
                try {
                  await linkExerciseEvidence(exerciseId, newSourceKey, newSourceNote);
                  setNewSourceKey("");
                  setNewSourceNote("");
                } catch {
                  setEvidenceError("Fonte não encontrada.");
                }
              })
            }
          >
            Vincular
          </Button>
        </div>
        {evidenceError ? <p className="mt-1 text-xs text-danger">{evidenceError}</p> : null}
      </div>
    </div>
  );
}
