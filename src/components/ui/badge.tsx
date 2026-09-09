import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Editorial spec-chips, not pills: square-cut, JetBrains-Mono, micro-caps.
// No rounded-full, no 1px border — the pill was half the generic look.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.09em]",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-muted",
        accent: "bg-accent-soft text-accent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        purple: "bg-tag-purple-bg text-tag-purple-fg",
        orange: "bg-tag-orange-bg text-tag-orange-fg",
        pink: "bg-tag-pink-bg text-tag-pink-fg",
        blue: "bg-tag-blue-bg text-tag-blue-fg",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
