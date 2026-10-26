"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { setMissingGear } from "@/lib/actions/gym";
import { ActionErrorText } from "@/components/social/session-expired";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/components/ui/use-autosave";
import { plural } from "@/lib/utils/format";
import type { GearChecklistGroup } from "./gym-gear";
import { missingCountText, withGear } from "./gym-options";
// Type only (erased): the server module that counts it never reaches the client.
import type { BlockedPlan } from "./gym-plan";

/**
 * Settings → Minha academia → Aparelhos: the gear the gym has, ticked
 * (everything at first); what the user unticks is Profile.missingGear, and
 * swaps and stand-ins stop offering exercises that need only that. Autosaved
 * as the whole list (setMissingGear) — a tap is one save, and a failed one
 * rolls the box back.
 *
 * Fifty-odd machines don't fit a phone screen: each group folds into one
 * row that says what it lacks, and opens at first where something already
 * does. Below them, when the active plan prescribes something the gym can't
 * do, the way to adjust it — the server works that out, and the page renders
 * again with each save (the action revalidates Settings), so it follows the
 * latest tick.
 */
export function GearChecklist({
  groups,
  initial,
  blockedPlan,
}: {
  groups: GearChecklistGroup[];
  /** Profile.missingGear, normalized (listed ids, catalog order). */
  initial: string[];
  /** The active plan's exercises the gym can't do, as the server counted them on this render. */
  blockedPlan: BlockedPlan | null;
}) {
  const { value, pending, savedAt, update, errorFor } = useAutosave({ missingGear: initial }, (next) => setMissingGear(next.missingGear));
  // The checklist's order is the catalog's: the order the list is stored in.
  const order = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups]);
  // Read once: from then on each group stays as the user leaves it (a save's re-render doesn't fold it).
  const [openAtFirst] = useState(() => new Set(groups.filter((g) => g.items.some((i) => initial.includes(i.id))).map((g) => g.id)));
  const missing = new Set(value.missingGear);
  const error = errorFor("missingGear");

  /** The gym has (`has`) — or lacks — these. */
  function mark(ids: string[], has: boolean) {
    update({ missingGear: withGear(value.missingGear, ids, has, order) });
  }

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold">Aparelhos</h3>
        <span className="shrink-0 text-[13px] tabular-nums text-muted" data-gear-missing-count>
          {missingCountText(missing.size)}
        </span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">
        Desmarque o que a sua academia não tem: as trocas só sugerem exercícios que dá para fazer nela.
      </p>

      <div className="mt-2 divide-y divide-border border-t border-border">
        {groups.map((group) => {
          const lacking = group.items.filter((i) => missing.has(i.id)).length;
          return (
            <details key={group.id} className="group/gear" open={openAtFirst.has(group.id) || undefined} data-gear-group={group.id}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 text-sm font-medium">{group.label}</span>
                {lacking > 0 ? (
                  <span className="shrink-0 text-[13px] tabular-nums text-muted">{missingCountText(lacking).toLowerCase()}</span>
                ) : null}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open/gear:rotate-180" aria-hidden />
              </summary>
              <fieldset className="pb-2">
                <legend className="sr-only">{group.label}</legend>
                <div className="grid grid-cols-1 gap-x-4 min-[420px]:grid-cols-2">
                  {group.items.map((item) => (
                    <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={!missing.has(item.id)}
                        onChange={(e) => mark([item.id], e.target.checked)}
                        className="size-5 shrink-0 accent-accent"
                      />
                      <span className="min-w-0">{item.name}</span>
                    </label>
                  ))}
                </div>
                {/* A gym without, say, any leg machine: one tap instead of twelve. */}
                <Button
                  variant="link"
                  size="sm"
                  className="min-h-11 px-0"
                  onClick={() => mark(group.items.map((i) => i.id), lacking > 0)}
                >
                  {lacking > 0 ? "Marcar todos" : "Desmarcar todos"}
                </Button>
              </fieldset>
            </details>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}

      {/* Always in the page, so the notice a tick brings in is read out. */}
      <div role="status">
        {blockedPlan && blockedPlan.count > 0 ? (
          <div className="mt-3 rounded-[var(--radius-md)] bg-warning-soft px-4 py-3" data-gym-plan-notice>
            <p className="text-sm text-foreground">
              Seu plano usa {plural(blockedPlan.count, "exercício", "exercícios")} com aparelhos que a sua academia não tem:{" "}
              <span className="font-medium">{blockedPlan.names}</span>.
            </p>
            <Button asChild size="sm" className="mt-2.5">
              <Link href={blockedPlan.href}>Ajustar à minha academia</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-3" />
    </div>
  );
}
