"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

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
        setError(data.error ?? "Request failed");
        return;
      }
      router.push("/sites");
      router.refresh();
    } catch {
      setError("Something went wrong");
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
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            className="rounded bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "提交中…" : isEdit ? "保存" : "添加"}
          </button>
          <Link
            href="/sites"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
