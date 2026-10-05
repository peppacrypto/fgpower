"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentSessionAllowBanned } from "@/lib/auth/require-user";
import { createRateLimiter } from "@/lib/export/rate-limit";

export interface DataRequestState {
  done?: true;
  error?: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).refine((v) => v.length <= 254),
  kind: z.enum(["ACCESS", "DELETE", "CORRECT", "PORTABILITY", "OTHER"]),
  message: z.string().trim().max(2000).optional(),
});

// This action is PUBLIC by design (it must work logged-out/suspended for LGPD
// art. 18), so a per-IP cap is its abuse control — otherwise an anonymous client
// could spam the DataRequest table. In-memory, single web replica (decision D-K).
const perIpRequests = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}

/**
 * A-050 — files an LGPD art. 18 request. Works for anyone (public page): a
 * signed-in user's id is attached when present, but a logged-out OR suspended
 * user can file too. Fulfilment is owner/manual — this only records the request.
 */
export async function submitDataRequest(_prev: DataRequestState, formData: FormData): Promise<DataRequestState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    kind: formData.get("kind"),
    message: formData.get("message") ?? undefined,
  });
  if (!parsed.success) return { error: "Confira o e-mail e tente de novo." };
  if (!perIpRequests.hit(clientIp(await headers())).ok) {
    return { error: "Muitas solicitações. Tente novamente mais tarde." };
  }
  const session = await getCurrentSessionAllowBanned();
  try {
    await prisma.dataRequest.create({
      data: {
        userId: session?.user.id ?? null,
        email: parsed.data.email,
        kind: parsed.data.kind,
        message: parsed.data.message || null,
      },
    });
  } catch (err) {
    console.error("submitDataRequest failed", err);
    return { error: "Não foi possível enviar agora. Tente de novo." };
  }
  return { done: true };
}
