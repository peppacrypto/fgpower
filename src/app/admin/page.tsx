import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { emailTransport } from "@/lib/email/config";
import { loginCodesDailyBudget } from "@/lib/email/login-gate";
import { lastLeaseRun } from "@/lib/jobs/lease";
import { pushTransport } from "@/lib/push/config";
import { REMINDER_LEASE } from "@/lib/reminders/engine";

export const metadata: Metadata = { title: "Admin" };

const DAY_MS = 86_400_000;

function minutesAgo(date: Date, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.floor(h / 24)} dias`;
}

export default async function AdminDashboard() {
  // The admin layout's check doesn't guard this page: a client navigation can render the page segment alone.
  await requireAdmin();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [
    users,
    exercises,
    curated,
    templates,
    evidence,
    openReports,
    sent7d,
    ignored7d,
    paused,
    pushUsers,
    digestUsers,
    emails24h,
    loginCodes24h,
    lease,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.exercise.count(),
    prisma.exercise.count({ where: { isCurated: true } }),
    prisma.workoutTemplate.count(),
    prisma.evidenceSource.count(),
    prisma.userReport.count({ where: { status: "OPEN" } }),
    prisma.reminderDelivery.count({ where: { status: "SENT", sentAt: { gte: weekAgo } } }),
    prisma.reminderDelivery.count({ where: { status: "SENT", sentAt: { gte: weekAgo }, ignoredAt: { not: null } } }),
    prisma.reminderPreference.count({ where: { pausedAt: { not: null } } }),
    prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
    prisma.reminderPreference.count({ where: { emailDigest: true } }),
    prisma.emailMessage.count({ where: { createdAt: { gte: dayAgo }, status: { in: ["SENT", "LOGGED"] } } }),
    prisma.emailMessage.count({ where: { createdAt: { gte: dayAgo }, kind: "LOGIN_CODE" } }),
    lastLeaseRun(REMINDER_LEASE),
  ]);

  const stats = [
    { label: "Usuários", value: users, href: null },
    { label: "Exercícios", value: exercises, href: "/admin/exercises" },
    { label: "Exercícios curados", value: curated, href: "/admin/exercises?curated=1" },
    { label: "Programas", value: templates, href: null },
    { label: "Fontes científicas", value: evidence, href: null },
    { label: "Denúncias abertas", value: openReports, href: "/admin/reports" },
  ];
  const reminders = [
    { label: "Lembretes enviados (7 d)", value: sent7d },
    { label: "Ignorados (7 d)", value: ignored7d },
    { label: "Usuários pausados", value: paused },
    { label: "Usuários com push", value: pushUsers },
    { label: "Inscritos no resumo", value: digestUsers },
    { label: "E-mails (24 h)", value: emails24h },
  ];

  const email = emailTransport();
  const push = pushTransport();
  // The all-addresses budget guards Resend's quota; the dev transport has none (lib/email/login-code).
  const budget = email === "resend" ? loginCodesDailyBudget() : null;
  const status = [
    email === "resend"
      ? "E-mail: Resend ✓"
      : email === "dev"
        ? "E-mail: dev — só registrado no banco (fora de produção)"
        : "E-mail: desligado — defina RESEND_API_KEY e EMAIL_FROM",
    push === "webpush" ? "Push: VAPID ✓" : push === "dev" ? "Push: dev — nada sai do servidor" : "Push: desligado — defina as chaves VAPID",
    lease?.lastRunAt
      ? `Último ciclo: ${minutesAgo(lease.lastRunAt, now)}`
      : "Último ciclo: nunca — defina REMINDER_SCHEDULER=on e CRON_SECRET",
    budget != null ? `Códigos de acesso (24 h): ${loginCodes24h}/${budget}` : `Códigos de acesso (24 h): ${loginCodes24h}`,
  ];
  const stale = lease?.lastRunAt && now.getTime() - lease.lastRunAt.getTime() > 20 * 60_000;
  const nearBudget = budget != null && loginCodes24h >= budget * 0.8;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Painel admin</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const content = (
            <Card className={s.href ? "transition-colors hover:border-accent/50" : ""}>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted">{s.label}</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href as never}>
              {content}
            </Link>
          ) : (
            <div key={s.label}>{content}</div>
          );
        })}
      </div>

      <section className="mt-10" aria-labelledby="admin-reminders">
        <SectionHead label="Lembretes e e-mails" id="admin-reminders" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {reminders.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted">{s.label}</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <ul className="mt-4 flex flex-col gap-1 font-mono text-xs" data-reminder-status>
          {status.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {stale || nearBudget ? (
          <p role="status" className="mt-3 border-l-2 border-l-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {stale ? "O ciclo de lembretes parou há mais de 20 minutos — confira o serviço. " : ""}
            {nearBudget ? "Os códigos de acesso estão perto do limite diário (LOGIN_CODES_DAILY_BUDGET)." : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
