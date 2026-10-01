import { getCurrentSession } from "@/lib/auth/require-user";
import { exportFilename, loadAccountExport, toExportJson, toTreinosCsv } from "@/lib/data/account-export";
import { createRateLimiter } from "@/lib/export/rate-limit";

/**
 * "Exportar meus dados" (W-151, spec §43.15 — training history belongs to the
 * user): GET ?format=csv (the training log as a spreadsheet, one row per set)
 * or ?format=json (everything the account keeps; the default, so older links
 * still work). The signed-in user's own data only. An export reads the whole
 * history, so it is limited per user (in process: one web replica, D-K).
 */
const limiter = createRateLimiter({ limit: 6, windowMs: 10 * 60 * 1000 });

const NO_STORE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: "Sua sessão expirou — entre de novo." }, { status: 401, headers: NO_STORE });
  }
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";

  const allowed = limiter.hit(session.user.id);
  if (!allowed.ok) {
    return new Response(`Muitas exportações seguidas. Tente de novo em ${Math.ceil(allowed.retryAfterSeconds / 60)} min.`, {
      status: 429,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(allowed.retryAfterSeconds) },
    });
  }

  const data = await loadAccountExport(session.user.id);
  const now = new Date();
  const body = format === "csv" ? toTreinosCsv(data) : JSON.stringify(toExportJson(data, now), null, 2);
  return new Response(body, {
    headers: {
      ...NO_STORE,
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(format, now)}"`,
    },
  });
}
