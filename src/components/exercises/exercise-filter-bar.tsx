"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";

interface FilterOption {
  id: string;
  namePt: string;
}

export function ExerciseFilterBar({
  muscleGroups,
  equipment,
  movementPatterns,
}: {
  muscleGroups: { group: string; namePt: string }[];
  equipment: FilterOption[];
  movementPatterns: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}` as never));
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            updateParam("q", e.target.value);
          }}
          placeholder="Buscar exercício (ex.: supino, agachamento, tríceps)"
          className="pl-10"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 lg:flex">
        <Select
          defaultValue={searchParams.get("muscleGroup") ?? ""}
          onChange={(e) => updateParam("muscleGroup", e.target.value)}
          className="lg:w-40"
        >
          <option value="">Músculo</option>
          {muscleGroups.map((g) => (
            <option key={g.group} value={g.group}>
              {g.namePt}
            </option>
          ))}
        </Select>
        <Select
          defaultValue={searchParams.get("equipmentId") ?? ""}
          onChange={(e) => updateParam("equipmentId", e.target.value)}
          className="lg:w-40"
        >
          <option value="">Equipamento</option>
          {equipment.map((e) => (
            <option key={e.id} value={e.id}>
              {e.namePt}
            </option>
          ))}
        </Select>
        <Select
          defaultValue={searchParams.get("movementPatternId") ?? ""}
          onChange={(e) => updateParam("movementPatternId", e.target.value)}
          className="lg:w-40"
        >
          <option value="">Movimento</option>
          {movementPatterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.namePt}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
