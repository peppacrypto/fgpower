"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/components/social/run-action";
import { saveBodyMetrics } from "@/lib/actions/body-metrics";
import { checkBodyValue } from "@/lib/training/body-weight";
import { parseDecimalInput } from "@/lib/training/set-plan";
import { formatNumber } from "@/lib/utils/format";

const DAY_MS = 86_400_000;
/** A weigh-in this far from the last one (and that one recent) asks "Confere?" first. */
const GUARD_RATIO = 0.1;
const GUARD_WITHIN_DAYS = 30;

/** "2026-09-28" → its day number (the São Paulo calendar date as typed). */
export function dayNoOfIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS) : null;
}

/** "81,4" — a body value for an input's placeholder or a sentence. */
export function formatBodyNumber(n: number): string {
  return formatNumber(n, 1);
}

/**
 * One weigh-in being typed and saved (Corpo's form, Today's "PESO DE HOJE"):
 * comma decimals, the kind's range, and — like "Editar séries" (W-088) — a
 * "Confere?" before saving a value more than 10% off a weigh-in from the last
 * 30 days (814 for 81,4). Saving never deletes: a blank field isn't sent.
 */
export function useWeighIn(last: { kg: number; day: number } | null) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** A value waiting for "Está certo". */
  const [confirm, setConfirm] = useState<{ value: number; date: string | null } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value: number, date: string | null) {
    setConfirm(null);
    startTransition(async () => {
      const result = await runAction(() =>
        saveBodyMetrics({ date, entries: [{ kind: "BODYWEIGHT", value }] }),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(value);
      setSavedAt(result.savedAt);
      setText("");
    });
  }

  /** Checks what was typed and saves it (or asks "Confere?" first). `date` null = today. */
  function submit(date: string | null, dayNo: number | null) {
    setError(null);
    setSavedAt(null);
    const parsed = parseDecimalInput(text);
    if (parsed == null) {
      setError(text.trim() === "" ? "Digite o peso." : "Use só números, como 81,4.");
      return;
    }
    const checked = checkBodyValue("BODYWEIGHT", parsed);
    if (!checked.ok) {
      setError(`${checked.error}.`);
      return;
    }
    const near = last && dayNo != null && Math.abs(dayNo - last.day) < GUARD_WITHIN_DAYS;
    if (near && last && Math.abs(checked.value - last.kg) / last.kg > GUARD_RATIO) {
      setConfirm({ value: checked.value, date });
      return;
    }
    save(checked.value, date);
  }

  return {
    text,
    setText: (v: string) => {
      setText(v);
      setError(null);
      setConfirm(null);
    },
    error,
    confirm,
    /** "Está certo": save the value as typed. */
    confirmSave: () => confirm && save(confirm.value, confirm.date),
    /** "Corrigir": back to the field. */
    cancelConfirm: () => setConfirm(null),
    pending,
    savedAt,
    saved,
    submit,
  };
}
