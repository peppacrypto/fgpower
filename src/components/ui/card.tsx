import * as React from "react";
import { cn } from "@/lib/utils/cn";

// A flat panel pinned by corner registration marks — no 1px border, no soft
// shadow, no big radius. Add `is-link` for interactive hover (marks extend +
// turn accent). See `.reg-frame` in globals.css.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("reg-frame", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
