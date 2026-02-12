"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

/**
 * Wraps the app with NextAuth SessionProvider for client-side signIn/signOut/useSession.
 * Toaster provides non-blocking toast feedback for button actions.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster richColors position="top-center" />
    </SessionProvider>
  );
}
