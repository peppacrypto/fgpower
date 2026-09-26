"use client";

import { ErrorPanel } from "@/components/pwa/error-panel";

// Root error boundary: public pages, login/onboarding, and failures of the
// /app layout itself (anything inside /app is caught by app/app/error.tsx).
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="pt-[env(safe-area-inset-top,0px)]">
      <ErrorPanel error={error} retry={retry} homeHref="/" homeLabel="Ir para o início" />
    </div>
  );
}
