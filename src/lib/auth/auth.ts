import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import * as z from "zod";
import { prisma } from "@/lib/db";
import { safeNextPath } from "@/lib/auth/safe-next";
import { emailEnabled } from "@/lib/email/config";
import { checkLoginCodeBudget, sendLoginCodeEmail } from "@/lib/email/login-code";
import {
  ADDRESS_LIMIT_CODE,
  emailOtpGate,
  GLOBAL_LIMIT_CODE,
  LOGIN_CODE_ATTEMPTS,
  LOGIN_CODE_LENGTH,
  LOGIN_CODE_TTL_SECONDS,
  SEND_CODE_PATH,
  SIGN_IN_CODE_PATH,
} from "@/lib/email/login-gate";

/**
 * The better-auth routes FGPOWER itself calls, and its two read-only pages.
 * Every other one, the plugins' included, answers 404, so an account changes
 * only through the app's own validated actions. Left open, /update-user let
 * anyone point User.image at any URL, which every viewer's browser then
 * fetched (an IP-logging pixel), and set a name of any length; the others
 * change the password, the sessions or the linked accounts behind the app's
 * back, or (the admin plugin's) skip the moderation rules of
 * lib/actions/admin. auth.integration.test.ts probes every route better-auth
 * serves.
 */
const APP_AUTH_ROUTES: ReadonlySet<string> = new Set([
  "/get-session", // every session check, and run-action's "is the session gone?"
  "/sign-in/social", // "Entrar com Google"…
  "/callback/:id", // …and Google's way back
  "/sign-out", // Settings' "Sair" (signOutAction)
  "/delete-user", // Settings' "Excluir conta"
  SEND_CODE_PATH, // sign-in by e-mail: the code… (emailOtpGate narrows both further)
  SIGN_IN_CODE_PATH, // …and signing in with it
  "/ok", // better-auth's health check
  "/error", // better-auth's error page
]);

/** Outside production only: /api/test/login's password sign-in for the E2E suites. */
const TEST_AUTH_ROUTES: ReadonlySet<string> = new Set(["/sign-in/email", "/sign-up/email"]);

/** Whether a better-auth route (its path pattern, such as "/callback/:id") is one the app calls. */
export function isAppAuthRoute(path: string | undefined, production = process.env.NODE_ENV === "production"): boolean {
  if (!path) return false;
  return APP_AUTH_ROUTES.has(path) || (!production && TEST_AUTH_ROUTES.has(path));
}

/**
 * FGPOWER auth: Google OAuth, or a one-time link + 6-digit code by e-mail
 * (decision 13, W-065 — only while e-mail is configured; no password-based
 * sign-in), an admin role for content curation (section 29 of the build
 * spec), and a unique public username used by the social layer
 * (`/u/[username]`).
 *
 * We deliberately do NOT use better-auth's `username()` plugin: that plugin
 * implements username+password sign-in, which FGPOWER doesn't offer. The
 * public handle is instead a plain `additionalFields` column with a DB
 * unique constraint, set by the user after their first Google sign-in.
 */
export const auth = betterAuth({
  appName: "FGPOWER",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Only ever enabled outside production. FGPOWER's real sign-in surface is
  // Google and the e-mail code (see app/login); this exists purely so
  // automated smoke tests / Playwright E2E can obtain a correctly-signed
  // session without a real Google account or inbox. No UI ever exposes it.
  emailAndPassword: { enabled: process.env.NODE_ENV !== "production" },

  // OAuth failures (cancelled consent, state mismatch…) land on the login page,
  // which explains them, instead of better-auth's bare error page.
  onAPIError: { errorURL: "/login" },

  socialProviders: {
    google: process.env.GOOGLE_CLIENT_ID
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          prompt: "select_account",
        }
      : undefined,
  },

  user: {
    additionalFields: {
      // Public handle for the social layer. Always lowercase/normalized;
      // `displayUsername` preserves the casing the user chose.
      username: { type: "string", required: false, unique: true, input: false },
      displayUsername: { type: "string", required: false, input: false },
    },
    deleteUser: {
      enabled: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days, renewed on use (approved 2026-09-27)
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    freshAge: 60 * 60 * 24, // account deletion requires a session created within this window
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    // Outside production the app also runs on other local ports (the shared
    // dev server, Playwright's): the browser's own auth calls (the e-mail
    // code, sign-out) come from there.
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:*", "http://127.0.0.1:*"] : []),
  ].filter((v): v is string => Boolean(v)),

  // Production only, in memory (one web replica): the emailOTP plugin's own
  // 3 requests / 60 s per IP on sending and on signing in with a code.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },

  hooks: {
    // Only the routes the app calls exist (APP_AUTH_ROUTES). Sign-in by
    // e-mail offers exactly two routes, only while e-mail is on
    // (lib/email/login-gate), and refuses a code to an address (or to
    // everyone) past its budget before the plugin creates one.
    before: createAuthMiddleware(async (ctx) => {
      if (!isAppAuthRoute(ctx.path)) throw new APIError("NOT_FOUND");
      const verdict = emailOtpGate(ctx.path, ctx.body, emailEnabled());
      if (verdict?.status === "NOT_FOUND") throw new APIError("NOT_FOUND");
      if (verdict?.status === "BAD_REQUEST") throw new APIError("BAD_REQUEST", { message: verdict.message });
      if (ctx.path !== SEND_CODE_PATH) return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (!z.email().safeParse(email).success) return; // the plugin answers INVALID_EMAIL
      const budget = await checkLoginCodeBudget(email);
      if (budget === "address") {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes for this address", code: ADDRESS_LIMIT_CODE });
      }
      if (budget === "global") {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Sign-in by e-mail is paused", code: GLOBAL_LIMIT_CODE });
      }
    }),
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { joins: true },
  },

  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    emailOTP({
      otpLength: LOGIN_CODE_LENGTH,
      expiresIn: LOGIN_CODE_TTL_SECONDS,
      allowedAttempts: LOGIN_CODE_ATTEMPTS,
      storeOTP: "hashed",
      // E-mail sign-up is the point: iPhone users without a Google account.
      disableSignUp: false,
      async sendVerificationOTP({ email, otp, type }, ctx) {
        if (type !== "sign-in") return; // the before-hook already refuses every other type
        // Where the login started (a program dossier, a shared profile…), sent
        // by the form as a header; the e-mail's link carries it on.
        await sendLoginCodeEmail({ email, otp, next: safeNextPath(ctx?.headers?.get("x-fg-next")) });
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
