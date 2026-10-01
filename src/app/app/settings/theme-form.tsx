"use client";

import { useState } from "react";
import { applyTheme, type ThemeChoice } from "@/lib/theme";
import { ChipRadioGroup } from "./chip-radio-group";

const OPTIONS = [
  { value: "system", label: "Automático", description: "segue o tema do sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
] as const satisfies readonly { value: ThemeChoice; label: string; description?: string }[];

/**
 * Settings → Aparência (W-149): the theme on this device. Applied at once,
 * with no server call; the choice is a cookie the <head> script reads on the
 * next page load (lib/theme). `initial` is that cookie as the page read it,
 * so the control renders the right chip with no flash.
 */
export function ThemeForm({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);
  const [announce, setAnnounce] = useState("");

  return (
    <div>
      <p id="theme-label" className="text-sm font-medium">
        Tema
      </p>
      <p id="theme-desc" className="mt-0.5 text-xs text-muted">
        Automático segue o tema do sistema do aparelho.
      </p>
      <ChipRadioGroup
        labelId="theme-label"
        describedBy="theme-desc"
        className="mt-2.5"
        options={OPTIONS}
        value={choice}
        onChange={(v) => {
          if (v === choice) return;
          setChoice(v);
          applyTheme(v);
          setAnnounce(v === "system" ? "Tema automático." : v === "dark" ? "Tema escuro." : "Tema claro.");
        }}
      />
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
