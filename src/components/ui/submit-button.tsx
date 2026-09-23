"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/**
 * A submit button that reflects its parent <form>'s pending state via react-dom
 * `useFormStatus`: while the bound server action runs it disables itself and,
 * when `pendingLabel` is given, swaps its label — giving tap feedback and
 * preventing double submits. Must be rendered inside the <form> it submits.
 * Keeps the editorial Button shape (square, keel); pass variant/size as usual.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
