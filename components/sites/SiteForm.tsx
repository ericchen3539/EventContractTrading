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
  hasApiKey?: boolean;
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
  const [apiKeyId, setApiKeyId] = useState("");
  const [apiKeyPrivateKey, setApiKeyPrivateKey] = useState("");
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
      if (adapterKey === "kalshi") {
        if (apiKeyId.trim()) body.apiKeyId = apiKeyId.trim();
        if (apiKeyPrivateKey.trim()) body.apiKeyPrivateKey = apiKeyPrivateKey.trim();
      }

      const url = isEdit ? `/api/sites/${site!.id}` : "/api/sites";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : res.statusText || "请求失败";
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
        {adapterKey === "kalshi" && (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Kalshi 交易凭证（用于获取 Portfolio、持仓等）
              </p>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                在 Kalshi 账户 → 账户与安全 → API Keys 中创建密钥，保存 API Key ID 和私钥（.key 文件内容）。
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="apiKeyId"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    API Key ID（可选）
                  </label>
                  <input
                    id="apiKeyId"
                    type="text"
                    value={apiKeyId}
                    onChange={(e) => setApiKeyId(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder={site?.hasApiKey ? "留空则不修改" : "例如：a952bcbe-ec3b-4b5b-b8f9-11dae589608c"}
                  />
                </div>
                <div>
                  <label
                    htmlFor="apiKeyPrivateKey"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    私钥 PEM（可选）
                  </label>
                  <textarea
                    id="apiKeyPrivateKey"
                    value={apiKeyPrivateKey}
                    onChange={(e) => setApiKeyPrivateKey(e.target.value)}
                    rows={4}
                    className={INPUT_CLASS + " font-mono text-sm"}
                    placeholder={site?.hasApiKey ? "留空则不修改" : "粘贴 .key 文件内容（PEM 格式）"}
                  />
                </div>
              </div>
            </div>
          </>
        )}
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
