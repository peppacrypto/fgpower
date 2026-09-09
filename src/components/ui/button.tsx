import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Editorial-dossier buttons: sharp (zero radius), no floating drop shadow.
// Filled variants get an inked "keel" (inset bottom bevel) for letterpress
// weight and press down on :active; text variants use a measured underline.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-semibold tracking-[-0.01em] transition-[background-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-[inset_0_-2px_0_var(--keel)] hover:bg-accent-hover active:translate-y-[0.5px] active:shadow-none",
        strong:
          "bg-accent-strong text-accent-strong-foreground shadow-[inset_0_-2px_0_var(--keel)] hover:brightness-[1.03] active:translate-y-[0.5px] active:brightness-[0.97] active:shadow-none",
        secondary: "bg-surface-2 text-foreground hover:bg-[var(--border)] active:translate-y-[0.5px]",
        outline:
          "bg-transparent text-foreground border-b-2 border-b-border-strong hover:border-b-accent hover:bg-[var(--ink-4)] active:translate-y-[0.5px]",
        ghost: "bg-transparent text-foreground hover:bg-surface-2 active:translate-y-[0.5px]",
        danger:
          "bg-danger text-[var(--danger-foreground)] shadow-[inset_0_-2px_0_var(--keel)] hover:brightness-95 active:translate-y-[0.5px] active:shadow-none",
        link: "h-auto px-0 bg-transparent text-accent underline decoration-2 underline-offset-[3px] decoration-[color-mix(in_oklab,var(--accent)_35%,transparent)] hover:decoration-accent",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5",
        lg: "h-13 px-7 text-base",
        icon: "size-11",
        bar: "h-12 w-full px-6 text-[15px] tracking-[0.01em] justify-between",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
      );
    }
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
