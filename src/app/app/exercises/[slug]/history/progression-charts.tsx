"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface ChartPoint {
  dateLabel: string;
  bestWeightKg: number | null;
  estimated1RmKg: number | null;
  sessionVolumeKg: number;
}

const AXIS_STYLE = { fontSize: 11, fill: "var(--muted)" };

export function ProgressionChart({
  data,
  dataKey,
  label,
  unit,
}: {
  data: ChartPoint[];
  dataKey: keyof ChartPoint;
  label: string;
  unit: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="dateLabel" tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(value) => [`${value}${unit}`, label]}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
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
