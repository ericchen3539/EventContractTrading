import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Sign in
      </h1>
      <Suspense fallback={<div className="h-64 w-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
