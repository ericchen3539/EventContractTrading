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

/** Map API error strings to user-facing semantic descriptions. */
function toSemanticError(err: string): string {
  if (err.includes("Unauthorized")) return "未登录或会话已过期，请重新登录";
  if (err.includes("Site not found")) return "站点不存在或无权访问";
  if (err.includes("Unknown adapter")) return "不支持的平台类型";
  if (err.includes("Failed to fetch events") || err.includes("Adapter fetch failed"))
    return err.replace(/^.*?:\s*/, "从平台拉取事件失败：");
  if (err.includes("Internal server error")) return "服务器内部错误";
  return err;
}

/**
 * Events page content: multi-site/section selectors, per-site update, and table.
 */
export function EventsPageContent({ sites }: EventsPageContentProps) {
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [sectionIdsBySite, setSectionIdsBySite] = useState<
    Record<string, Set<string>>
  >({});
  const [sectionsBySite, setSectionsBySite] = useState<
    Record<string, SectionItem[]>
  >({});
  const [events, setEvents] = useState<EventItem[]>([]);
  const [newEvents, setNewEvents] = useState<EventItem[]>([]);
  const [changedEvents, setChangedEvents] = useState<EventItem[]>([]);
  const [loadingSectionsBySite, setLoadingSectionsBySite] = useState<
    Record<string, boolean>
  >({});
  const [updatingSiteId, setUpdatingSiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const fetchFollowedIds = useCallback(async () => {
    try {
      const res = await fetch("/api/me/followed-event-ids");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setFollowedIds(new Set(data));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFollowedIds();
  }, [fetchFollowedIds]);

  const handleFollow = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        setFollowedIds((prev) => new Set([...prev, eventId]));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleUnfollow = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/follow`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSectionsForSite = useCallback(
    async (siteId: string) => {
      setLoadingSectionsBySite((prev) => ({ ...prev, [siteId]: true }));
      setError(null);
      try {
        const res = await fetch(
          `/api/sections?siteId=${encodeURIComponent(siteId)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "获取板块失败");
          setSectionsBySite((prev) => ({ ...prev, [siteId]: [] }));
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setSectionsBySite((prev) => ({ ...prev, [siteId]: list }));
      } catch {
        setError("获取板块失败");
        setSectionsBySite((prev) => ({ ...prev, [siteId]: [] }));
      } finally {
        setLoadingSectionsBySite((prev) => ({ ...prev, [siteId]: false }));
      }
    },
    []
  );

  useEffect(() => {
    if (selectedSiteIds.length === 0) {
      setSectionsBySite({});
      return;
    }
    for (const siteId of selectedSiteIds) {
      fetchSectionsForSite(siteId);
    }
  }, [selectedSiteIds, fetchSectionsForSite]);

  const updateEventsForSite = useCallback(
    async (siteId: string) => {
      const sections = sectionsBySite[siteId] ?? [];
      const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
      const selected = sectionIdsBySite[siteId];
      const idsToUse =
        selected && selected.size > 0
          ? Array.from(selected).filter((id) => enabledIds.includes(id))
          : enabledIds;

      setError(null);
      setUpdateResult(null);
      setUpdatingSiteId(siteId);
      try {
        const url = new URL(
          `/api/sites/${siteId}/events`,
          window.location.origin
        );
        if (idsToUse.length > 0) {
          url.searchParams.set("sectionIds", idsToUse.join(","));
        }
        const res = await fetch(url.toString(), { credentials: "include" });
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          const text = await res.text().catch(() => "");
          setError(
            `更新失败！${toSemanticError(text || `HTTP ${res.status}`)}`
          );
          return;
        }
        if (!res.ok) {
          const obj =
            data && typeof data === "object"
              ? (data as Record<string, unknown>)
              : null;
          const errStr =
            typeof obj?.error === "string"
              ? (obj.error as string)
              : typeof obj?.message === "string"
                ? (obj.message as string)
                : `HTTP ${res.status}`;
          setError(`更新失败！${toSemanticError(errStr)}`);
          return;
        }
        const payload =
          data &&
          typeof data === "object" &&
          "newEvents" in data &&
          "changedEvents" in data
            ? (data as { newEvents: EventItem[]; changedEvents: EventItem[] })
            : { newEvents: [] as EventItem[], changedEvents: [] as EventItem[] };
        const apiNew = payload.newEvents ?? [];
        const apiChanged = payload.changedEvents ?? [];
        const allFromUpdate = [...apiNew, ...apiChanged] as EventItem[];

        setNewEvents(apiNew as EventItem[]);
        setChangedEvents(apiChanged as EventItem[]);
        const newCount = apiNew.length;
        const changedCount = apiChanged.length;
        const parts: string[] = ["更新成功"];
        if (newCount > 0) parts.push(`新增 ${newCount} 个事件`);
        if (changedCount > 0) parts.push(`变更 ${changedCount} 个事件`);
        setUpdateResult(parts.length > 1 ? parts.join("，") : parts[0]);
        setEvents((prev) => {
          const rest = prev.filter((e) => e.siteId !== siteId);
          const merged = [...rest, ...allFromUpdate];
          merged.sort((a, b) => {
            const aT = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
            const bT = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
            return aT - bT;
          });
          return merged;
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err ?? "未知错误");
        setError(`更新失败！${toSemanticError(msg)}`);
      } finally {
        setUpdatingSiteId(null);
      }
    },
    [sectionsBySite, sectionIdsBySite]
  );

  const updateAllSites = useCallback(async () => {
    for (const siteId of selectedSiteIds) {
      await updateEventsForSite(siteId);
    }
  }, [selectedSiteIds, updateEventsForSite]);

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    );
  };

  const toggleSection = (siteId: string, sectionId: string) => {
    const sections = sectionsBySite[siteId] ?? [];
    const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
    setSectionIdsBySite((prev) => {
      const curr = prev[siteId] ?? new Set<string>();
      const next = new Set(curr.size === 0 ? enabledIds : curr);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      const out = { ...prev };
      out[siteId] =
        next.size === enabledIds.length ? new Set<string>() : next;
      return out;
    });
  };

  const sectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const list of Object.values(sectionsBySite)) {
      for (const s of list) {
        map[s.id] = s.name;
      }
    }
    return map;
  }, [sectionsBySite]);

  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sites) {
      map[s.id] = s.name;
    }
    return map;
  }, [sites]);

  const isUpdatingAny =
    updatingSiteId !== null ||
    Object.values(loadingSectionsBySite).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          事件市场
        </h1>
        {(error || updateResult) && (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              error
                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
            }`}
          >
            {error ?? updateResult}
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              站点（可多选）
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {sites.map((site) => (
                <label
                  key={site.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedSiteIds.includes(site.id)}
                    onChange={() => toggleSite(site.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                  />
                  {site.name} ({site.adapterKey})
                </label>
              ))}
            </div>
          </div>

          {selectedSiteIds.length > 0 && (
            <div className="space-y-3">
              {selectedSiteIds.map((siteId) => {
                const site = siteMap.get(siteId);
                const sections = sectionsBySite[siteId] ?? [];
                const loading = loadingSectionsBySite[siteId];
                const enabledSections = sections.filter((s) => s.enabled);
                const selected = sectionIdsBySite[siteId];
                const selectedCount =
                  selected && selected.size > 0 ? selected.size : enabledSections.length;

                return (
                  <div
                    key={siteId}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {site?.name ?? siteId}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateEventsForSite(siteId)}
                        disabled={
                          isUpdatingAny ||
                          (loading && updatingSiteId !== siteId)
                        }
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                      >
                        {updatingSiteId === siteId
                          ? "更新中…"
                          : "更新"}
                      </button>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        板块筛选：
                        {selectedCount === 0 || selectedCount === enabledSections.length
                          ? "全部已启用板块"
                          : `已选 ${selectedCount} 个`}
                      </span>
                      {loading ? (
                        <p className="mt-1 text-sm text-slate-500">
                          加载板块中…
                        </p>
                      ) : enabledSections.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {enabledSections.map((sec) => (
                            <label
                              key={sec.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  !selected ||
                                  selected.size === 0 ||
                                  selected.has(sec.id)
                                }
                                onChange={() =>
                                  toggleSection(siteId, sec.id)
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                              />
                              {sec.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-slate-500">
                          无已启用板块，请先在站点编辑页勾选板块。
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {selectedSiteIds.length > 1 && (
                <button
                  type="button"
                  onClick={updateAllSites}
                  disabled={isUpdatingAny}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {updatingSiteId ? "更新中…" : "更新全部"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {newEvents.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            新增事件
          </h2>
          <EventsTable
            events={newEvents}
            sectionNameMap={sectionNameMap}
            siteNameMap={selectedSiteIds.length > 1 ? siteNameMap : undefined}
            followedIds={followedIds}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        </div>
      )}

      {changedEvents.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            变更事件
          </h2>
          <EventsTable
            events={changedEvents}
            sectionNameMap={sectionNameMap}
            siteNameMap={selectedSiteIds.length > 1 ? siteNameMap : undefined}
            followedIds={followedIds}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        </div>
      )}

      <div className="space-y-2">
        {events.length > 0 && (
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            全部事件
          </h2>
        )}
        <EventsTable
          events={events}
          sectionNameMap={sectionNameMap}
          siteNameMap={selectedSiteIds.length > 1 ? siteNameMap : undefined}
          followedIds={followedIds}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
        />
      </div>
    </div>
  );
}
