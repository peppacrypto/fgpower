"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A text box that grows with what is typed, so a long name ("Sexta — Pernas
 * (posterior de coxa e glúteos)") or a GD cue is read whole on a 320px phone
 * instead of cut at the box's edge. `singleLine` keeps it one value (Enter
 * leaves the box, pasted line breaks become spaces) — the day's name and focus.
 */
export const AutoGrowText = forwardRef<
  HTMLTextAreaElement,
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
    value: string;
    onValueChange: (value: string) => void;
    singleLine?: boolean;
    /** Tallest it grows before scrolling, in px. */
    maxHeight?: number;
  }
>(function AutoGrowText({ value, onValueChange, singleLine, maxHeight = 240, className, onKeyDown, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inner.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={setRef}
      rows={1}
      value={value}
      onChange={(e) => onValueChange(singleLine ? e.target.value.replace(/[\r\n]+/g, " ") : e.target.value)}
      onKeyDown={(e) => {
        if (singleLine && e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
      className={cn("block w-full resize-none overflow-y-auto", className)}
      {...props}
    />
  );
});
