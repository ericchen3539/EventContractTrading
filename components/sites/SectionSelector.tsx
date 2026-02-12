"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/** Section as returned by GET /api/sections. */
export interface SectionItem {
  id: string;
  siteId: string;
  externalId: string;
  name: string;
  urlOrSlug?: string;
  enabled: boolean;
}

interface SectionSelectorProps {
  siteId: string;
}

/**
 * Section selector block for site edit page.
 * Fetches sections from API, shows sync button and checkboxes for enabled state.
 */
export function SectionSelector({ siteId }: SectionSelectorProps) {
  const router = useRouter();
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sections?siteId=${encodeURIComponent(siteId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load sections");
        setSections([]);
        return;
      }
      setSections(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load sections");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  async function handleSync() {
    setError(null);
    setSyncing(true);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) {
        setError(data?.error ?? `Sync failed (${res.status})`);
        return;
      }
      await fetchSections();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(section: SectionItem) {
    const nextEnabled = !section.enabled;
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, enabled: nextEnabled } : s))
    );
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Update failed");
        setSections((prev) =>
          prev.map((s) => (s.id === section.id ? { ...s, enabled: section.enabled } : s))
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Update failed");
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? { ...s, enabled: section.enabled } : s))
      );
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-blue-50/50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-400">加载板块中…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-blue-50/50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          板块选择
        </h3>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {syncing ? "同步中…" : "从平台同步"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        勾选要拉取事件的板块；首次使用请先点击「从平台同步」获取可用板块。
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {sections.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          暂无板块，点击「从平台同步」拉取。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sections.map((sec) => (
            <li
              key={sec.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <input
                type="checkbox"
                id={`section-${sec.id}`}
                checked={sec.enabled}
                onChange={() => handleToggle(sec)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <label
                htmlFor={`section-${sec.id}`}
                className="flex-1 cursor-pointer text-sm text-slate-800 dark:text-slate-200"
              >
                {sec.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
