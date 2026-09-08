import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "@/lib/db";

/**
 * FGPOWER auth: Google OAuth only (no password-based sign-in), an admin
 * role for content curation (section 29 of the build spec), and a unique
 * public username used by the social layer (`/u/[username]`).
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
  // Google-only (see GoogleSignInButton); this exists purely so automated
  // smoke tests / Playwright E2E can obtain a correctly-signed session
  // without needing a real Google account. No UI ever exposes it.
  emailAndPassword: { enabled: process.env.NODE_ENV !== "production" },

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
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    freshAge: 60 * 60 * 24, // account deletion requires a session created within this window
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
    (v): v is string => Boolean(v),
  ),

  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { joins: true },
  },

  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
