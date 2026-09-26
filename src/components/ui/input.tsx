import * as React from "react";
import { cn } from "@/lib/utils/cn";

// Form controls. The boundary is foreground/50 (≥3:1 on the surface, WCAG
// 1.4.11) so a field reads as a field in gym light, not as floating text.
// Text is 16px on phones — iOS Safari zooms into any focused field under
// 16px and stays zoomed — and the denser 14px from `sm` up.
const CONTROL =
  "flex w-full rounded-[3px] border border-foreground/50 bg-surface px-3.5 text-foreground transition-colors hover:border-foreground/70 disabled:cursor-not-allowed disabled:opacity-50";

// A caller that sets its own font size (e.g. the builder's big title field)
// keeps it on every breakpoint instead of being pulled back to sm:text-sm.
const OWN_SIZE = /(^|\s)text-(xs|sm|base|lg|[2-9]?xl|\[\d)/;
const textSize = (className?: string) => (className && OWN_SIZE.test(className) ? undefined : "text-base sm:text-sm");

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", enterKeyHint, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      // Search fields get the keyboard's "search" key unless told otherwise.
      enterKeyHint={enterKeyHint ?? (type === "search" ? "search" : undefined)}
      className={cn(CONTROL, "h-11 placeholder:text-muted", textSize(className), className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(CONTROL, "min-h-24 py-2.5 placeholder:text-muted", textSize(className), className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium text-foreground", className)} {...props} />
  ),
);
Label.displayName = "Label";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(CONTROL, "h-11", textSize(className), className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";
