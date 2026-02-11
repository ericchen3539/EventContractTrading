"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Wraps the app with NextAuth SessionProvider for client-side signIn/signOut/useSession.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
