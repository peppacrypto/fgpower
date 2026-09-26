import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "FGPOWER — Treine com um motivo",
    template: "%s · FGPOWER",
  },
  description:
    "FGPOWER é uma plataforma de musculação orientada por ciência: programas com base em evidências, biblioteca de exercícios detalhada e progressão registrada semana após semana.",
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
  openGraph: {
    type: "website",
    siteName: "FGPOWER",
    locale: "pt_BR",
  },
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
