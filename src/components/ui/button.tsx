import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Buttons (docs/DESIGN.md): 10px radius, no shadow at rest. One filled green
// for the main action of a screen (primary; `strong` is the same, kept as a
// name for the hero CTAs), a neutral tonal fill for secondary, a white
// bordered outline, and plain ghost/link. `sm` keeps its 36px look but takes
// a 44px touch target (.hit, globals.css).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
        strong: "bg-accent text-accent-foreground hover:bg-accent-hover",
        secondary: "bg-surface-2 text-foreground hover:bg-[var(--border)]",
        outline:
          "border border-border-strong bg-surface text-foreground shadow-[var(--shadow-sm)] hover:border-field hover:bg-surface-2",
        ghost: "bg-transparent text-foreground hover:bg-surface-2",
        danger: "bg-danger text-[var(--danger-foreground)] hover:brightness-95",
        link: "h-auto px-0 bg-transparent text-accent underline decoration-1 underline-offset-[3px] decoration-[color-mix(in_oklab,var(--accent)_40%,transparent)] hover:decoration-accent active:scale-100",
      },
      size: {
        sm: "hit h-9 px-3.5 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-11",
        bar: "h-12 w-full px-6 text-[15px] justify-between",
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
