"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EventsTable, type EventItem } from "./EventsTable";

export type SiteItem = {
  id: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  hasCredentials: boolean;
  createdAt: string;
};

export type SectionItem = {
  id: string;
  siteId: string;
  externalId: string;
  name: string;
  urlOrSlug?: string;
  enabled: boolean;
};

interface EventsPageContentProps {
  sites: SiteItem[];
}

/**
 * Events page content: site/section selectors, refresh, and table.
 * Fetches sections when site changes; fetches events on refresh.
 */
export function EventsPageContent({ sites }: EventsPageContentProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = useCallback(async (siteId: string) => {
    setError(null);
    setLoadingSections(true);
    try {
      const res = await fetch(`/api/sections?siteId=${encodeURIComponent(siteId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "获取板块失败");
        setSections([]);
        return;
      }
      setSections(Array.isArray(data) ? data : []);
      setSelectedSectionIds(new Set());
    } catch {
      setError("获取板块失败");
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSiteId) {
      setSections([]);
      setEvents([]);
      setError(null);
      return;
    }
    fetchSections(selectedSiteId);
  }, [selectedSiteId, fetchSections]);

  const fetchEvents = useCallback(async () => {
    if (!selectedSiteId) {
      setError("请先选择站点");
      return;
    }
    setError(null);
    setLoadingEvents(true);
    setEvents([]);
    try {
      const url = new URL(`/api/sites/${selectedSiteId}/events`, window.location.origin);
      const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
      const idsToUse = selectedSectionIds.size > 0
        ? Array.from(selectedSectionIds).filter((id) => enabledIds.includes(id))
        : enabledIds;
      if (idsToUse.length > 0) {
        url.searchParams.set("sectionIds", idsToUse.join(","));
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "获取事件失败");
        return;
      }
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setError("获取事件失败");
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedSiteId, sections, selectedSectionIds]);

  const toggleSection = (sectionId: string) => {
    setSelectedSectionIds((prev) => {
      const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
      const next = new Set(prev.size === 0 ? enabledIds : prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next.size === enabledIds.length ? new Set<string>() : next;
    });
  };

  const sectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sections) {
      map[s.id] = s.name;
    }
    return map;
  }, [sections]);

  const enabledSections = sections.filter((s) => s.enabled);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        事件市场
      </h1>

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="site-select" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              站点
            </label>
            <select
              id="site-select"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">请选择站点</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.adapterKey})
                </option>
              ))}
            </select>
          </div>

          {selectedSiteId && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  板块筛选（可选）
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedSectionIds.size === 0
                    ? "不选则拉取所有已启用板块"
                    : `已选 ${selectedSectionIds.size} 个板块`}
                </p>
                {loadingSections ? (
                  <p className="mt-1 text-sm text-zinc-500">加载板块中…</p>
                ) : enabledSections.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {enabledSections.map((sec) => (
                      <label
                        key={sec.id}
                        className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedSectionIds.size === 0 ||
                            selectedSectionIds.has(sec.id)
                          }
                          onChange={() => toggleSection(sec.id)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600"
                        />
                        {sec.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">
                    无已启用板块，请先在站点编辑页勾选板块。
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={fetchEvents}
                disabled={loadingEvents || loadingSections}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loadingEvents ? "拉取中…" : "刷新"}
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <EventsTable events={events} sectionNameMap={sectionNameMap} />
    </div>
  );
}
