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
      const res = await fetch(`/api/sections?siteId=${encodeURIComponent(siteId)}`);
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
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      setSections(Array.isArray(data) ? data : []);
      router.refresh();
    } catch {
      setError("Sync failed");
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
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">加载板块中…</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          板块选择
        </h3>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          {syncing ? "同步中…" : "从平台同步"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        勾选要拉取事件的板块；首次使用请先点击「从平台同步」获取可用板块。
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {sections.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          暂无板块，点击「从平台同步」拉取。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sections.map((sec) => (
            <li
              key={sec.id}
              className="flex items-center gap-3 rounded border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <input
                type="checkbox"
                id={`section-${sec.id}`}
                checked={sec.enabled}
                onChange={() => handleToggle(sec)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label
                htmlFor={`section-${sec.id}`}
                className="flex-1 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200"
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
