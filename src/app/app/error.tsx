"use client";

import { ErrorPanel } from "@/components/pwa/error-panel";

// Error boundary for everything under /app. It sits inside the app layout, so
// the bottom nav / sidebar stay on screen and the user is never stranded.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel error={error} retry={retry} homeHref="/app/today" homeLabel="Ir para Hoje" />;
}
