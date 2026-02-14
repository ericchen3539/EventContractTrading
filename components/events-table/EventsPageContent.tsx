"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { EventsTable, type EventItem } from "./EventsTable";
import { MarketsTable, type MarketItem } from "@/components/markets-table/MarketsTable";

const EVENTS_PAGE_SITES_STORAGE_KEY = "events-page-selected-sites";

function loadSelectedSitesFromStorage(validSiteIds: string[]): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_PAGE_SITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === "string" && validSiteIds.includes(id)
    );
  } catch {
    return [];
  }
}

function saveSelectedSitesToStorage(siteIds: string[]) {
  try {
    localStorage.setItem(
      EVENTS_PAGE_SITES_STORAGE_KEY,
      JSON.stringify(siteIds)
    );
  } catch {
    // ignore
  }
}

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
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadSelectedSitesFromStorage(siteIds);
    if (saved.length > 0) {
      setSelectedSiteIds(saved);
    }
  }, [siteIds]);
  const [sectionIdsBySite, setSectionIdsBySite] = useState<
    Record<string, Set<string>>
  >({});
  const [sectionsBySite, setSectionsBySite] = useState<
    Record<string, SectionItem[]>
  >({});
  const [newEvents, setNewEvents] = useState<EventItem[]>([]);
  const [changedEvents, setChangedEvents] = useState<EventItem[]>([]);
  const [newMarkets, setNewMarkets] = useState<MarketItem[]>([]);
  const [changedMarkets, setChangedMarkets] = useState<MarketItem[]>([]);
  const [loadingSectionsBySite, setLoadingSectionsBySite] = useState<
    Record<string, boolean>
  >({});
  const [updatingSiteId, setUpdatingSiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [attentionMap, setAttentionMap] = useState<Record<string, number>>({});
  const [marketAttentionMap, setMarketAttentionMap] = useState<Record<string, number>>({});

  const fetchAttentionMap = useCallback(async () => {
    try {
      const res = await fetch("/api/me/attention-map");
      const data = await res.json();
      if (res.ok && data && typeof data === "object") {
        setAttentionMap(data as Record<string, number>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAttentionMap();
  }, [fetchAttentionMap]);

  const fetchMarketAttentionMap = useCallback(async () => {
    try {
      const res = await fetch("/api/me/market-attention-map");
      const data = await res.json();
      if (res.ok && data && typeof data === "object") {
        setMarketAttentionMap(data as Record<string, number>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMarketAttentionMap();
  }, [fetchMarketAttentionMap]);

  const handleUpdateMarkets = useCallback(
    async (eventId: string) => {
      try {
        const res = await fetch(`/api/events/${eventId}/markets/update`, {
          method: "PUT",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          const errStr = typeof data?.error === "string" ? data.error : "更新市场失败";
          toast.error(`更新所有市场失败：${errStr}`);
          return;
        }
        const apiNew = Array.isArray(data?.newMarkets) ? data.newMarkets : [];
        const apiChanged = Array.isArray(data?.changedMarkets) ? data.changedMarkets : [];
        const adapterEmpty = data?.adapterReturnedEmpty === true;
        if (adapterEmpty) {
          toast.info("该事件在平台暂无市场数据");
        } else if (apiNew.length > 0 || apiChanged.length > 0) {
          setNewMarkets((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of apiNew) byId.set(m.id, m);
            return Array.from(byId.values());
          });
          setChangedMarkets((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of apiChanged) byId.set(m.id, m);
            return Array.from(byId.values());
          });
          const parts: string[] = [];
          if (apiNew.length > 0) parts.push(`新增 ${apiNew.length} 个市场`);
          if (apiChanged.length > 0) parts.push(`变更 ${apiChanged.length} 个市场`);
          toast.success(parts.join("，"));
        } else if (!adapterEmpty) {
          toast.success("该事件暂无新增或变更的市场");
        }
      } catch {
        toast.error("更新所有市场失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

  const handleBatchUpdateMarkets = useCallback(
    async (eventIds: string[]) => {
      if (eventIds.length === 0) return;
      try {
        const res = await fetch("/api/events/markets/update/batch", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventIds }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          const errStr = typeof data?.error === "string" ? data.error : "批量更新失败";
          toast.error(`批量更新所有市场失败：${errStr}`);
          return;
        }
        const apiNew = Array.isArray(data?.newMarkets) ? data.newMarkets : [];
        const apiChanged = Array.isArray(data?.changedMarkets) ? data.changedMarkets : [];
        const newCount = typeof data?.newCount === "number" ? data.newCount : 0;
        const changedCount = typeof data?.changedCount === "number" ? data.changedCount : 0;
        const failedCount = typeof data?.failedCount === "number" ? data.failedCount : 0;

        if (apiNew.length > 0 || apiChanged.length > 0) {
          setNewMarkets((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of apiNew) byId.set(m.id, m as MarketItem);
            return Array.from(byId.values());
          });
          setChangedMarkets((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of apiChanged) byId.set(m.id, m as MarketItem);
            return Array.from(byId.values());
          });
        }

        const parts: string[] = [];
        if (newCount > 0) parts.push(`新增 ${newCount} 个市场`);
        if (changedCount > 0) parts.push(`更新 ${changedCount} 个市场`);
        if (failedCount > 0) {
          toast.error(
            parts.length > 0
              ? `批量更新完成：${parts.join("，")}；${failedCount} 个事件失败`
              : `批量更新完成：${failedCount} 个事件失败`
          );
        } else {
          toast.success(
            parts.length > 0 ? parts.join("，") : "已批量更新，暂无新增或变更的市场"
          );
        }
      } catch {
        toast.error("批量更新所有市场失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

  const handleMarketAttentionChange = useCallback(
    async (marketId: string, level: number) => {
      try {
        const res = await fetch(`/api/markets/${marketId}/attention`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attentionLevel: level }),
        });
        if (res.ok) {
          setMarketAttentionMap((prev) => ({ ...prev, [marketId]: level }));
          toast.success(level === 0 ? "已设为不再关注" : `关注度已更新为 ${level}`);
        } else {
          const data = await res.json().catch(() => ({}));
          const errMsg = typeof data?.error === "string" ? data.error : "更新失败";
          toast.error(`更新关注度失败：${errMsg}`);
        }
      } catch {
        toast.error("更新关注度失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

  const handleBatchMarketAttentionChange = useCallback(
    async (marketIds: string[], level: number) => {
      try {
        const res = await fetch("/api/markets/attention/batch", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: marketIds.map((marketId) => ({ marketId, attentionLevel: level })),
          }),
        });
        if (res.ok) {
          const updates: Record<string, number> = {};
          for (const id of marketIds) updates[id] = level;
          setMarketAttentionMap((prev) => ({ ...prev, ...updates }));
          toast.success(`已批量更新 ${marketIds.length} 个市场的关注度为 ${level}`);
        } else {
          const data = await res.json().catch(() => ({}));
          const errMsg = typeof data?.error === "string" ? data.error : "批量更新失败";
          toast.error(`批量更新关注度失败：${errMsg}`);
        }
      } catch {
        toast.error("批量更新关注度失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

  const handleAttentionChange = useCallback(
    async (eventId: string, level: number) => {
      try {
        const res = await fetch(`/api/events/${eventId}/attention`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attentionLevel: level }),
        });
        if (res.ok) {
          setAttentionMap((prev) => ({ ...prev, [eventId]: level }));
          toast.success(level === 0 ? "已设为不再关注" : `关注度已更新为 ${level}`);
        } else {
          const data = await res.json().catch(() => ({}));
          const errMsg = typeof data?.error === "string" ? data.error : "更新失败";
          toast.error(`更新关注度失败：${errMsg}`);
        }
      } catch {
        toast.error("更新关注度失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

  const handleBatchAttentionChange = useCallback(
    async (eventIds: string[], level: number) => {
      try {
        const res = await fetch("/api/events/attention/batch", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: eventIds.map((eventId) => ({
              eventId,
              attentionLevel: level,
            })),
          }),
        });
        if (res.ok) {
          const updates: Record<string, number> = {};
          for (const id of eventIds) updates[id] = level;
          setAttentionMap((prev) => ({ ...prev, ...updates }));
          toast.success(`已批量更新 ${eventIds.length} 个事件的关注度为 ${level}`);
        } else {
          const data = await res.json().catch(() => ({}));
          const errMsg = typeof data?.error === "string" ? data.error : "批量更新失败";
          toast.error(`批量更新关注度失败：${errMsg}`);
        }
      } catch {
        toast.error("批量更新关注度失败：网络或服务器错误，请稍后重试");
      }
    },
    []
  );

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
          const errDisplay = `更新失败！${toSemanticError(text || `HTTP ${res.status}`)}`;
          setError(errDisplay);
          toast.error(errDisplay);
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
          const errDisplay = `更新失败！${toSemanticError(errStr)}`;
          setError(errDisplay);
          toast.error(errDisplay);
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

        setNewEvents(apiNew as EventItem[]);
        setChangedEvents(apiChanged as EventItem[]);
        const newCount = apiNew.length;
        const changedCount = apiChanged.length;
        const parts: string[] = ["更新成功"];
        if (newCount > 0) parts.push(`新增 ${newCount} 个事件`);
        if (changedCount > 0) parts.push(`变更 ${changedCount} 个事件`);
        if (newCount === 0 && changedCount === 0)
          parts.push("无新增事件及变更事件");
        const resultMsg = parts.join("，");
        setUpdateResult(resultMsg);
        toast.success(resultMsg);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err ?? "未知错误");
        const errDisplay = `更新失败！${toSemanticError(msg)}`;
        setError(errDisplay);
        toast.error(errDisplay);
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
    setSelectedSiteIds((prev) => {
      const next = prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId];
      saveSelectedSitesToStorage(next);
      return next;
    });
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
          事件更新
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
            attentionMap={attentionMap}
            onAttentionChange={handleAttentionChange}
            onBatchAttentionChange={handleBatchAttentionChange}
            onUpdateMarkets={handleUpdateMarkets}
            onBatchUpdateMarkets={handleBatchUpdateMarkets}
            pageSize={10}
            selectable
            enableSelectAll
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
            attentionMap={attentionMap}
            onAttentionChange={handleAttentionChange}
            onBatchAttentionChange={handleBatchAttentionChange}
            onUpdateMarkets={handleUpdateMarkets}
            onBatchUpdateMarkets={handleBatchUpdateMarkets}
            pageSize={10}
            highlightColumns={["nextTradingCloseTime", "endDate"]}
            selectable
            enableSelectAll
          />
        </div>
      )}

      {newMarkets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            新增市场
          </h2>
          <MarketsTable
            markets={newMarkets}
            sectionNameMap={sectionNameMap}
            siteNameMap={selectedSiteIds.length > 1 ? siteNameMap : undefined}
            attentionMap={marketAttentionMap}
            onAttentionChange={handleMarketAttentionChange}
            onBatchAttentionChange={handleBatchMarketAttentionChange}
            pageSize={10}
            selectable
            enableSelectAll
          />
        </div>
      )}

      {changedMarkets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            价格变更市场
          </h2>
          <MarketsTable
            markets={changedMarkets}
            sectionNameMap={sectionNameMap}
            siteNameMap={selectedSiteIds.length > 1 ? siteNameMap : undefined}
            attentionMap={marketAttentionMap}
            onAttentionChange={handleMarketAttentionChange}
            onBatchAttentionChange={handleBatchMarketAttentionChange}
            pageSize={10}
            selectable
            enableSelectAll
          />
        </div>
      )}
    </div>
  );
}
