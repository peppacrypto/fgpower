import type { Route } from "next";
import {
  CircleUser,
  ClipboardList,
  Dumbbell,
  Home,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
}

/** Primary navigation — mirrors the mobile bottom nav and desktop sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app/today", label: "Hoje", icon: Home },
  { href: "/app/programs", label: "Programas", icon: ClipboardList },
  { href: "/app/exercises", label: "Exercícios", icon: Dumbbell },
  { href: "/app/progress", label: "Progresso", icon: LineChart },
  { href: "/app/profile", label: "Perfil", icon: CircleUser },
];
