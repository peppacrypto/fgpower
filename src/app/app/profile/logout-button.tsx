"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

/** Sign-out control for mobile: the desktop sidebar has its own "Sair", but on a
 * phone the sidebar never renders, so this lives in the Profile header. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Sair"
      title="Sair"
      disabled={pending}
      onClick={() => {
        setPending(true);
        authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } }).catch(() => setPending(false));
      }}
    >
      <LogOut className="size-4" />
    </Button>
  );
}
