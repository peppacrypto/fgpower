"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatKg, formatNumber, formatVolume, plural } from "@/lib/utils/format";

export interface ChartPoint {
  dateLabel: string;
  bestWeightKg: number | null;
  estimated1RmKg: number | null;
  sessionVolumeKg: number;
  /** Reps of the session's best set (seconds, for a hold). */
  bestReps: number | null;
}

const AXIS_STYLE = { fontSize: 11, fill: "var(--muted)" };

/** Ticks as bare pt-BR numbers ("62,5", "1.225"); the tooltip carries the unit. */
const FORMATS = {
  kg: { tick: (v: number) => formatNumber(v, 1), value: formatKg },
  volume: { tick: (v: number) => formatNumber(v, 0), value: formatVolume },
  /** Bodyweight exercises: the best set's reps, or a hold's seconds. */
  reps: { tick: (v: number) => formatNumber(v, 0), value: (v: number) => plural(v, "rep", "reps") },
  seconds: { tick: (v: number) => formatNumber(v, 0), value: (v: number) => `${formatNumber(v, 0)}\u00a0s` },
} as const;

export function ProgressionChart({
  data,
  dataKey,
  label,
  format,
}: {
  data: ChartPoint[];
  dataKey: keyof ChartPoint;
  label: string;
  /** "kg" for loads and e1RM, "volume" for kg × reps totals, "reps"/"seconds" for bodyweight sets. */
  format: keyof typeof FORMATS;
}) {
  const f = FORMATS[format];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {/* A tap on the chart focuses it (keyboard layer): no focus box unless it came from the keyboard. */}
      <div className="h-48 w-full [&_:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="dateLabel" tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => f.tick(v)}
            />
            <Tooltip
              formatter={(value) => [typeof value === "number" ? f.value(value) : String(value ?? "—"), label]}
              separator=": "
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
