import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Sign in
      </h1>
      <Suspense fallback={<div className="h-64 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
