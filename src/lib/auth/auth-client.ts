"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient(), emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
