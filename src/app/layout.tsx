import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeSync } from "@/components/theme/theme-sync";
import { appOrigin } from "@/lib/app-origin";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute og:image / og:url for every preview: NEXT_PUBLIC_APP_URL when it's
  // a valid URL, else https://fgpower.monster in production (never localhost,
  // never the request's Host) — lib/app-origin.ts.
  metadataBase: new URL(appOrigin()),
  title: {
    default: "FGPOWER — Treine com um motivo",
    template: "%s · FGPOWER",
  },
  description:
    "FGPOWER é uma plataforma de musculação orientada por ciência: programas com base em evidências, biblioteca de exercícios detalhada e progressão registrada semana após semana. Grátis e sem cartão.",
  applicationName: "FGPOWER",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // "default" lays the installed app out below the iOS status bar, with
    // status text that follows the system appearance. "black-translucent"
    // drew every page under the clock (workout "Finalizar" included) with
    // white text that vanished on the light theme.
    statusBarStyle: "default",
    title: "FGPOWER",
  },
  // The preview image is the root segment's opengraph-image.jpg (1200×630, < 300 KB for WhatsApp);
  // /t and /u draw their own.
  openGraph: {
    type: "website",
    siteName: "FGPOWER",
    locale: "pt_BR",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --background in globals.css for each scheme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* The device's theme choice, applied before the first paint (never cookies() here: every page would turn dynamic). */}
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ServiceWorkerRegistration />
        <ThemeSync />
      </body>
    </html>
  );
}
