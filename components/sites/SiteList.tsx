"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type SiteItem = {
  id: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  hasCredentials: boolean;
  createdAt: string;
};

interface SiteListProps {
  sites: SiteItem[];
}

/**
 * Sites list with edit link and delete action.
 * Delete confirmation via native confirm(); revalidates on success.
 */
export function SiteList({ sites }: SiteListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(site: SiteItem) {
    if (!confirm(`确定要删除站点「${site.name}」吗？`)) return;
    setDeletingId(site.id);
    try {
      const res = await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "删除失败");
        return;
      }
      router.refresh();
    } catch {
      alert("删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  if (sites.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">暂无站点</p>
        <Link
          href="/sites/new"
          className="mt-4 inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          添加站点
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
              名称
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
              URL
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
              平台
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
              凭证
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {sites.map((site) => (
            <tr key={site.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                {site.name}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                <a
                  href={site.baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {site.baseUrl}
                </a>
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {site.adapterKey}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {site.hasCredentials ? "已设置" : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/sites/${site.id}/edit`}
                  className="mr-3 text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  编辑
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(site)}
                  disabled={deletingId === site.id}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  {deletingId === site.id ? "删除中…" : "删除"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
