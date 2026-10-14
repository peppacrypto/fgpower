import * as React from "react";
import { cn } from "@/lib/utils/cn";

// The one container (`.card` in globals.css): white surface, soft hairline,
// 14px radius. Add `is-link` when the whole card is a link or button.
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
