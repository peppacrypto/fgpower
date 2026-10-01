"use client";

import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { afterSignInHref, isEmailAddress } from "./link/login-link";
import { sendCodeErrorText, signInErrorText, type AuthCallError } from "./sign-in-errors";

/** Seconds before "reenviar" works again. */
const RESEND_AFTER_S = 60;
const LINK = "font-semibold text-accent underline decoration-2 underline-offset-[3px] disabled:text-muted disabled:no-underline";

/**
 * Sign in by e-mail (decision 13, W-065): the address, then one e-mail with a
 * link AND a 6-digit code. The link is for a tap on this phone or computer;
 * the code is for the installed iPhone app (its own cookies: a link from
 * Mail would sign in Safari instead), so it's asked for right here. Six
 * digits sign in by themselves. A new account goes through onboarding, an
 * onboarded one straight on to `next`.
 */
export function EmailSignIn({ next, initialEmail }: { next: string | null; initialEmail: string | null }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  // Back from another page with the browser's back button (bfcache): not "Entrando…" forever.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setPending(null);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // The resend countdown ticks only while it runs.
  useEffect(() => {
    if (resendAt <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [resendAt, now]);

  async function send(address: string, again: boolean) {
    setPending("send");
    setError(null);
    setNotice("");
    try {
      const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
        fetchOptions: { headers: { "x-fg-next": next ?? "" } },
      });
      if (failure) {
        setError(sendCodeErrorText(failure as AuthCallError));
        return false;
      }
    } catch {
      setError(sendCodeErrorText(null));
      return false;
    } finally {
      setPending(null);
    }
    const t = Date.now();
    setNow(t);
    setResendAt(t + RESEND_AFTER_S * 1000);
    setSentTo(address);
    setCode("");
    if (again) setNotice(`Enviamos um novo link e um novo código para ${address}.`);
    return true;
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!isEmailAddress(address)) {
      setError("Confira o e-mail digitado.");
      emailRef.current?.focus();
      return;
    }
    if (await send(address, false)) requestAnimationFrame(() => codeRef.current?.focus());
  }

  async function verify(value: string) {
    if (!sentTo || pending) return;
    setPending("verify");
    setError(null);
    setNotice("");
    try {
      const { error: failure } = await authClient.signIn.emailOtp({ email: sentTo, otp: value });
      if (!failure) {
        // Leaving: keep "Entrando…" until the next page takes over.
        window.location.assign(afterSignInHref(next));
        return;
      }
      setError(signInErrorText(failure as AuthCallError));
    } catch {
      setError(signInErrorText(null));
    }
    setPending(null);
    requestAnimationFrame(() => codeRef.current?.select());
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === 6 && digits !== code) void verify(digits);
  }

  function useAnotherEmail() {
    setSentTo(null);
    setCode("");
    setError(null);
    setNotice("");
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  const status = (
    <p role="status" className={notice ? "text-sm text-muted" : "sr-only"}>
      {notice}
    </p>
  );
  const errorLine = error ? (
    <p id={errorId} role="alert" className="text-sm font-medium text-danger">
      {error}
    </p>
  ) : null;

  if (!sentTo) {
    return (
      <form onSubmit={onSubmitEmail} noValidate className="flex flex-col gap-2">
        <Label htmlFor="login-email">E-mail</Label>
        <Input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {errorLine}
        <Button type="submit" variant="outline" size="lg" className="mt-1 w-full" disabled={pending !== null}>
          {pending === "send" ? "Enviando…" : "Receber link de acesso"}
        </Button>
        <p className="text-xs text-muted">Enviamos um link e um código de 6 dígitos. Sem senha.</p>
        {status}
      </form>
    );
  }

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <div className="flex flex-col gap-3" data-email-sent>
      <div className="border-l-2 border-l-accent bg-surface-2 px-3.5 py-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Verifique seu e-mail</p>
        <p className="mt-1 text-sm [overflow-wrap:anywhere]">
          Enviamos um link de acesso para <strong className="font-semibold">{sentTo}</strong>. Toque no link no
          celular, ou digite o código:
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
          else setError("Digite os 6 dígitos do código.");
        }}
        noValidate
        className="flex flex-col gap-2"
      >
        <Input
          ref={codeRef}
          id="login-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          enterKeyHint="go"
          aria-label="Código de 6 dígitos"
          placeholder="000000"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-13 text-center font-mono text-2xl font-bold tracking-[0.35em] placeholder:text-foreground/25"
        />
        {errorLine}
        <Button type="submit" variant="strong" size="lg" className="w-full" disabled={pending !== null}>
          {pending === "verify" ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Não chegou? Veja o spam ou{" "}
        <button
          type="button"
          className={cn(LINK, "hit")}
          disabled={wait > 0 || pending !== null}
          onClick={() => void send(sentTo, true)}
        >
          {wait > 0 ? `reenviar em ${wait} s` : "reenviar"}
        </button>{" "}
        ·{" "}
        <button type="button" className={cn(LINK, "hit")} disabled={pending === "verify"} onClick={useAnotherEmail}>
          usar outro e-mail
        </button>
      </p>
      {status}
    </div>
  );
}
