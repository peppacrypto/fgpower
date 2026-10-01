import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-surface-2", className)}
      {...props}
    />
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden bg-surface-2", className)}>
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 px-6 py-14 text-center">
      {icon ? <div className="text-border-strong">{icon}</div> : null}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/**
 * Only a Google account photo (what Google sign-in stores): https on Google's
 * avatar host, no port, no credentials, the host rule of lib/og/avatar.ts.
 * Any other URL in User.image (better-auth's /update-user accepted any before
 * it was closed) would be fetched by every viewer's browser, an IP-logging
 * pixel: those draw the initials instead.
 */
function googlePhotoSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    const google =
      url.protocol === "https:" && url.hostname === "lh3.googleusercontent.com" && !url.port && !url.username && !url.password;
    return google ? url.href : null;
  } catch {
    return null;
  }
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const photo = googlePhotoSrc(src);
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URLs
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
