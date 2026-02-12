"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  EventsTable,
  type EventItem,
} from "@/components/events-table/EventsTable";
import type { SiteItem, SectionItem } from "@/components/events-table/EventsPageContent";

/** Event from GET /api/me/followed-events (includes siteName, sectionName). */
type FollowedEventItem = EventItem & {
  siteName?: string;
  sectionName?: string;
};

interface MePageContentProps {
  sites: SiteItem[];
}

export function MePageContent({ sites }: MePageContentProps) {
  const [followedEvents, setFollowedEvents] = useState<FollowedEventItem[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sectionIdsBySite, setSectionIdsBySite] = useState<
    Record<string, Set<string>>
  >({});
  const [sectionsBySite, setSectionsBySite] = useState<
    Record<string, SectionItem[]>
  >({});
  const [loadingSections, setLoadingSections] = useState(false);
  const [browseEvents, setBrowseEvents] = useState<EventItem[]>([]);
  const [loadingCached, setLoadingCached] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const [daysFilterPreset, setDaysFilterPreset] = useState<
    "3" | "7" | "30" | "all" | "custom"
  >("3");
  const [daysFilterCustom, setDaysFilterCustom] = useState(1);

  const daysFilter: number | "all" =
    daysFilterPreset === "custom"
      ? daysFilterCustom
      : daysFilterPreset === "all"
        ? "all"
        : parseInt(daysFilterPreset, 10);

  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const fetchFollowedEvents = useCallback(async () => {
    setLoadingFollowed(true);
    try {
      const res = await fetch("/api/me/followed-events");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setFollowedEvents(data);
        setFollowedIds(new Set(data.map((e: FollowedEventItem) => e.id)));
      } else {
        setFollowedEvents([]);
      }
    } catch {
      setFollowedEvents([]);
    } finally {
      setLoadingFollowed(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowedEvents();
  }, [fetchFollowedEvents]);

  const handleFollow = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/follow`, {
        method: "POST",
      });
      if (res.ok) {
        setFollowedIds((prev) => new Set([...prev, eventId]));
        fetchFollowedEvents();
      }
    } catch {
      // ignore
    }
  }, [fetchFollowedEvents]);

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
        setFollowedEvents((prev) => prev.filter((e) => e.id !== eventId));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSectionsForSite = useCallback(async (siteId: string) => {
    setLoadingSections(true);
    setBrowseError(null);
    try {
      const res = await fetch(
        `/api/sections?siteId=${encodeURIComponent(siteId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setBrowseError(data.error ?? "获取板块失败");
        setSectionsBySite((prev) => ({ ...prev, [siteId]: [] }));
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setSectionsBySite((prev) => ({ ...prev, [siteId]: list }));
    } catch {
      setBrowseError("获取板块失败");
      setSectionsBySite((prev) => ({ ...prev, [siteId]: [] }));
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      fetchSectionsForSite(selectedSiteId);
    } else {
      setSectionsBySite({});
      setSectionIdsBySite({});
    }
  }, [selectedSiteId, fetchSectionsForSite]);

  const loadCachedEvents = useCallback(async () => {
    if (!selectedSiteId) return;
    setBrowseError(null);
    setLoadingCached(true);
    try {
      const sections = sectionsBySite[selectedSiteId] ?? [];
      const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
      const selected = sectionIdsBySite[selectedSiteId];
      const idsToUse =
        selected && selected.size > 0
          ? Array.from(selected).filter((id) => enabledIds.includes(id))
          : enabledIds;

      const url = new URL(
        `/api/sites/${selectedSiteId}/events/cached`,
        window.location.origin
      );
      if (idsToUse.length > 0) {
        url.searchParams.set("sectionIds", idsToUse.join(","));
      }
      if (daysFilter === "all") {
        url.searchParams.set("days", "all");
      } else {
        url.searchParams.set("days", String(Math.max(1, daysFilter)));
      }
      const res = await fetch(url.toString(), { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        const errStr =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : "获取缓存事件失败";
        setBrowseError(errStr);
        setBrowseEvents([]);
        return;
      }
      setBrowseEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "未知错误");
      setBrowseError(`请求失败: ${msg}`);
      setBrowseEvents([]);
    } finally {
      setLoadingCached(false);
    }
  }, [selectedSiteId, sectionsBySite, sectionIdsBySite, daysFilter]);

  const toggleSection = useCallback((siteId: string, sectionId: string) => {
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
  }, [sectionsBySite]);

  const browseSectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    const list = selectedSiteId ? sectionsBySite[selectedSiteId] ?? [] : [];
    for (const s of list) {
      map[s.id] = s.name;
    }
    return map;
  }, [selectedSiteId, sectionsBySite]);

  const browseSiteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sites) {
      map[s.id] = s.name;
    }
    return map;
  }, [sites]);

  const followedSectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of followedEvents) {
      if (e.sectionName) map[e.sectionId] = e.sectionName;
    }
    return map;
  }, [followedEvents]);

  const followedSiteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of followedEvents) {
      if (e.siteName) map[e.siteId] = e.siteName;
    }
    return map;
  }, [followedEvents]);

  const sections = selectedSiteId ? sectionsBySite[selectedSiteId] ?? [] : [];
  const enabledSections = sections.filter((s) => s.enabled);
  const selectedSections = selectedSiteId ? sectionIdsBySite[selectedSiteId] : undefined;
  const selectedCount =
    selectedSections && selectedSections.size > 0
      ? selectedSections.size
      : enabledSections.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        我的
      </h1>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          我的事件
        </h2>

        {loadingFollowed ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">加载中…</p>
          </div>
        ) : followedEvents.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">暂无关注事件</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              前往{" "}
              <Link
                href="/events"
                className="font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
              >
                事件市场
              </Link>{" "}
              或在下方浏览并添加关注
            </p>
          </div>
        ) : (
          <EventsTable
            events={followedEvents}
            sectionNameMap={followedSectionNameMap}
            siteNameMap={
              Object.keys(followedSiteNameMap).length > 1
                ? followedSiteNameMap
                : undefined
            }
            followedIds={followedIds}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          浏览并关注
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                站点
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    <input
                      type="radio"
                      name="browse-site"
                      checked={selectedSiteId === site.id}
                      onChange={() => setSelectedSiteId(site.id)}
                      className="h-3.5 w-3.5 rounded-full border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600"
                    />
                    {site.name} ({site.adapterKey})
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                天数范围（最近交易结束时间）
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["3", "7", "30", "all"] as const).map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    <input
                      type="radio"
                      name="browse-days"
                      checked={daysFilterPreset === p}
                      onChange={() => setDaysFilterPreset(p)}
                      className="h-3.5 w-3.5 rounded-full border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600"
                    />
                    {p === "all" ? "全部" : `${p}天`}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800">
                  <input
                    type="radio"
                    name="browse-days"
                    checked={daysFilterPreset === "custom"}
                    onChange={() => setDaysFilterPreset("custom")}
                    className="h-3.5 w-3.5 rounded-full border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600"
                  />
                  自定义
                </label>
                {daysFilterPreset === "custom" && (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={daysFilterCustom}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 1) {
                          setDaysFilterCustom(v);
                        }
                      }}
                      className="w-16 rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      天
                    </span>
                  </>
                )}
              </div>
            </div>

            {selectedSiteId && (
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {siteMap.get(selectedSiteId)?.name ?? selectedSiteId}
                  </span>
                  <button
                    type="button"
                    onClick={loadCachedEvents}
                    disabled={loadingSections || loadingCached}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {loadingCached ? "加载中…" : "加载"}
                  </button>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    板块筛选：
                    {selectedCount === 0 || selectedCount === enabledSections.length
                      ? "全部已启用板块"
                      : `已选 ${selectedCount} 个`}
                  </span>
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
                              !selectedSections ||
                              selectedSections.size === 0 ||
                              selectedSections.has(sec.id)
                            }
                            onChange={() => toggleSection(selectedSiteId, sec.id)}
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
              </div>
            )}

            {browseError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {browseError}
              </p>
            )}
          </div>
        </div>

        <EventsTable
          events={browseEvents}
          sectionNameMap={browseSectionNameMap}
          siteNameMap={undefined}
          followedIds={followedIds}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          emptyStateMessage={
            !selectedSiteId
              ? "请选择站点和板块后点击加载"
              : loadingCached
                ? "加载中…"
                : "该站点/板块暂无缓存事件，请先在事件市场更新"
          }
          emptyStateSubMessage={
            !selectedSiteId || loadingCached
              ? undefined
              : "请先在事件市场点击「更新」拉取事件。"
          }
        />
      </div>
    </div>
  );
}
