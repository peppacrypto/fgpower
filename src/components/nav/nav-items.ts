import type { Route } from "next";
import type * as React from "react";
import { GToday, GProgram, GLoad, GProgress, GProfile } from "@/components/ui/glyph";

export interface NavItem {
  href: Route;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

/** Primary navigation — mirrors the mobile bottom nav and desktop sidebar.
 * Uses the FGPOWER keyline glyph family, not clichéd pictographic icons. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app/today", label: "Hoje", icon: GToday },
  { href: "/app/programs", label: "Programas", icon: GProgram },
  { href: "/app/exercises", label: "Exercícios", icon: GLoad },
  { href: "/app/progress", label: "Progresso", icon: GProgress },
  { href: "/app/profile", label: "Perfil", icon: GProfile },
];
