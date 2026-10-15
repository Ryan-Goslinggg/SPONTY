import { createAuthClient } from "better-auth/react";

/** Browser-side auth calls (sign up, sign in, sign out). Talks to /api/auth on the same origin. */
export const authClient = createAuthClient();
