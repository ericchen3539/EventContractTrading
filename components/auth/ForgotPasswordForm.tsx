"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

/**
 * Forgot password form: submit email to receive reset link.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "发送失败");
        return;
      }
      toast.success("若该邮箱已注册，将收到重置邮件，请查收");
      setSubmitted(true);
    } catch {
      toast.error("发送失败：网络错误");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <p className="text-center text-slate-600 dark:text-slate-400">
          若该邮箱已注册，您将收到重置邮件。请查收并点击链接设置新密码。
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-blue-600 py-2 px-4 text-center font-medium text-white transition hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            电子邮箱
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-2 px-4 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {loading ? "发送中…" : "发送重置邮件"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
        >
          返回登录
        </Link>
      </p>
    </div>
  );
}
