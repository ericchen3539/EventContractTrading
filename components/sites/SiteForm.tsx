"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

/**
 * Site form for create and edit.
 * API does not return credentials; edit mode shows hasCredentials hint when set.
 */
export type SiteFormValues = {
  id?: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  hasCredentials?: boolean;
};

const ADAPTER_OPTIONS = [
  { value: "kalshi", label: "Kalshi" },
] as const;

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

interface SiteFormProps {
  /** When provided, form submits PUT; otherwise POST. */
  site?: SiteFormValues;
}

export function SiteForm({ site }: SiteFormProps) {
  const router = useRouter();
  const isEdit = !!site;

  const [name, setName] = useState(site?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(site?.baseUrl ?? "");
  const [adapterKey, setAdapterKey] = useState(site?.adapterKey ?? "kalshi");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        adapterKey,
      };
      if (loginUsername.trim()) body.loginUsername = loginUsername.trim();
      if (loginPassword) body.loginPassword = loginPassword;

      const url = isEdit ? `/api/sites/${site!.id}` : "/api/sites";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error ?? "请求失败";
        setError(errMsg);
        toast.error(isEdit ? `保存失败：${errMsg}` : `添加失败：${errMsg}`);
        return;
      }
      toast.success(isEdit ? "站点已保存" : "站点已添加");
      router.push("/sites");
      router.refresh();
    } catch {
      setError("Something went wrong");
      toast.error(isEdit ? "保存失败：网络或服务器错误，请稍后重试" : "添加失败：网络或服务器错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            站点名称 *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={INPUT_CLASS}
            placeholder="例如：Kalshi"
          />
        </div>
        <div>
          <label
            htmlFor="baseUrl"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            基础 URL *
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            className={INPUT_CLASS}
            placeholder="https://trading.kalshi.com"
          />
        </div>
        <div>
          <label
            htmlFor="adapterKey"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            平台类型 *
          </label>
          <select
            id="adapterKey"
            value={adapterKey}
            onChange={(e) => setAdapterKey(e.target.value)}
            required
            className={INPUT_CLASS}
          >
            {ADAPTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="loginUsername"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            登录用户名（可选）
          </label>
          <input
            id="loginUsername"
            type="text"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            className={INPUT_CLASS}
            placeholder={site?.hasCredentials ? "留空则不修改" : "Kalshi 读板块无需登录"}
          />
        </div>
        <div>
          <label
            htmlFor="loginPassword"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            登录密码（可选）
          </label>
          <input
            id="loginPassword"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder={site?.hasCredentials ? "留空则不修改" : ""}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {loading ? "提交中…" : isEdit ? "保存" : "添加"}
          </button>
          <Link
            href="/sites"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
