"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Verify email page: handles ?token=xxx from email link.
 * Redirects to API which does the actual verification and redirects to login.
 */
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  useEffect(() => {
    if (token && !error) {
      window.location.href = `/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    }
  }, [token, error]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          邮箱验证
        </h1>
        <p className="text-center text-red-600 dark:text-red-400">
          {error === "missing"
            ? "未提供验证链接"
            : "链接无效或已过期，请重新申请"}
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 py-2 px-4 font-medium text-white transition hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          返回登录
        </Link>
      </div>
    );
  }

  if (token) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          邮箱验证
        </h1>
        <p className="text-slate-600 dark:text-slate-400">正在验证，请稍候…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        邮箱验证
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        请通过邮件中的链接完成验证。
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-blue-600 py-2 px-4 font-medium text-white transition hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        返回登录
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 w-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
