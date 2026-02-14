"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

/**
 * User account page content: profile display, email verification, change password.
 */
export function AccountPageContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          toast.error("加载失败：" + data.error);
          return;
        }
        setProfile(data);
      })
      .catch(() => toast.error("加载失败：网络错误"))
      .finally(() => setLoading(false));
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.hasPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("新密码至少 8 位");
      return;
    }
    setChangePwdLoading(true);
    try {
      const res = await fetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("修改失败：" + (data.error ?? "未知错误"));
        return;
      }
      toast.success("密码已修改");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("修改失败：网络错误");
    } finally {
      setChangePwdLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("发送失败：" + (data.error ?? "未知错误"));
        return;
      }
      toast.success("验证邮件已发送，请查收");
    } catch {
      toast.error("发送失败：网络错误");
    } finally {
      setResendLoading(false);
    }
  }

  const cardClass =
    "rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none";

  if (loading) {
    return (
      <div className={`mt-6 ${cardClass} p-8`}>
        <p className="text-slate-500 dark:text-slate-400">加载中…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`mt-6 ${cardClass} p-8`}>
        <p className="text-red-600 dark:text-red-400">无法加载用户信息</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className={cardClass}>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          基本信息
        </h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className={labelClass}>用户名</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {profile.name || "—"}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>电子邮箱</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {profile.email || "—"}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>邮箱验证</dt>
            <dd className="flex items-center gap-2">
              {profile.emailVerified ? (
                <span className="text-green-600 dark:text-green-400">已验证</span>
              ) : (
                <>
                  <span className="text-amber-600 dark:text-amber-400">
                    未验证
                  </span>
                  {profile.email && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                    >
                      {resendLoading ? "发送中…" : "重新发送验证邮件"}
                    </button>
                  )}
                </>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {profile.hasPassword && (
        <div className={cardClass}>
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            修改密码
          </h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label htmlFor="currentPassword" className={labelClass}>
                当前密码
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="newPassword" className={labelClass}>
                新密码（至少 8 位）
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                确认新密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={changePwdLoading}
              className="rounded-lg bg-blue-600 py-2 px-4 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {changePwdLoading ? "提交中…" : "修改密码"}
            </button>
          </form>
        </div>
      )}

      {!profile.hasPassword && (
        <div className={cardClass}>
          <p className="text-slate-500 dark:text-slate-400">
            您通过 Google 登录，本站无独立密码，无法在此修改密码。
          </p>
        </div>
      )}
    </div>
  );
}
