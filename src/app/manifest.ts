import type { MetadataRoute } from "next";

/** Home-screen long-press entries (Android); each opens straight into its screen. */
const SHORTCUTS = [
  { name: "Treino de hoje", short_name: "Hoje", url: "/app/today", icon: "today" },
  { name: "Progresso", short_name: "Progresso", url: "/app/progress", icon: "progress" },
  { name: "Histórico", short_name: "Histórico", url: "/app/history", icon: "history" },
] as const;

/** Phone screenshots for the richer install dialog (Chrome on Android). */
const SCREENSHOTS = [
  { file: "today", label: "Hoje: o próximo treino a um toque" },
  { file: "workout", label: "Treino: cargas, repetições e descanso de cada série" },
  { file: "summary", label: "Resumo: o que o treino rendeu e o próximo passo" },
] as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    // The app's identity. It equals the start_url, which is what browsers
    // used as the id before one was set, so existing installs keep theirs.
    id: "/app/today",
    name: "FGPOWER — Treinamento com evidência",
    short_name: "FGPOWER",
    description:
      "Programas de musculação baseados em evidência, execução de treino e progressão registrada.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/app/today",
    // The whole site: login (and its Google round trip back), onboarding and
    // public profiles stay inside the installed app instead of dropping to a
    // browser bar (the implicit scope was /app/).
    scope: "/",
    display: "standalone",
    // The light --background: the app is light-first, so the Android splash
    // and title bar match what most users land on (the <meta theme-color>
    // in layout.tsx still switches per color scheme once the page loads).
    background_color: "#fafafb",
    theme_color: "#fafafb",
    orientation: "portrait-primary",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // One full-bleed plate per shortcut, declared maskable too: its glyph sits
    // inside the 80% safe zone, so Android launchers can mask it to their own
    // shape instead of shrinking it into a white circle.
    shortcuts: SHORTCUTS.map((s) => {
      const src = `/icons/shortcut-${s.icon}-96.png`;
      return {
        name: s.name,
        short_name: s.short_name,
        url: s.url,
        icons: [
          { src, sizes: "96x96", type: "image/png", purpose: "any" as const },
          { src, sizes: "96x96", type: "image/png", purpose: "maskable" as const },
        ],
      };
    }),
    screenshots: SCREENSHOTS.map((s) => ({
      src: `/icons/screenshots/${s.file}.png`,
      sizes: "780x1688",
      type: "image/png",
      form_factor: "narrow" as const,
      label: s.label,
    })),
  };
}
