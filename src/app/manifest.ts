import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FGPOWER — Treinamento com evidência",
    short_name: "FGPOWER",
    description:
      "Programas de musculação baseados em evidência, execução de treino e progressão registrada.",
    start_url: "/app/today",
    display: "standalone",
    // The light --background: the app is light-first, so the Android splash
    // and title bar match what most users land on (the <meta theme-color>
    // in layout.tsx still switches per color scheme once the page loads).
    background_color: "#fafafb",
    theme_color: "#fafafb",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
