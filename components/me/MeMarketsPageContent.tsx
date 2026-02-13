"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  MarketsTable,
  type MarketItem,
} from "@/components/markets-table/MarketsTable";
import type { SiteItem, SectionItem } from "@/components/events-table/EventsPageContent";

const ATTENTION_FILTER_STORAGE_KEY = "me-markets-page-attention-filter";
const BROWSE_PREFS_STORAGE_KEY = "me-markets-page-browse-prefs";

type AttentionFilterPreset = "0" | "1" | "2" | "3" | "custom";
type DaysFilterPreset = "3" | "7" | "30" | "all" | "custom";

function loadAttentionFilterFromStorage(): {
  preset: AttentionFilterPreset;
  custom: number;
} {
  if (typeof window === "undefined") return { preset: "1", custom: 1 };
  try {
    const raw = localStorage.getItem(ATTENTION_FILTER_STORAGE_KEY);
    if (!raw) return { preset: "1", custom: 1 };
    const parsed = JSON.parse(raw) as { preset?: string; custom?: number };
    const preset = ["0", "1", "2", "3", "custom"].includes(parsed?.preset ?? "")
      ? (parsed.preset as AttentionFilterPreset)
      : "1";
    const custom =
      typeof parsed?.custom === "number" &&
      !Number.isNaN(parsed.custom) &&
      parsed.custom >= 0
        ? parsed.custom
        : 1;
    return { preset, custom };
  } catch {
    return { preset: "1", custom: 1 };
  }
}

function saveAttentionFilterToStorage(
  preset: AttentionFilterPreset,
  custom: number
) {
  try {
    localStorage.setItem(
      ATTENTION_FILTER_STORAGE_KEY,
      JSON.stringify({ preset, custom })
    );
  } catch {
    // ignore
  }
}

interface BrowsePrefs {
  siteId?: string;
  daysPreset?: DaysFilterPreset;
  daysCustom?: number;
  sectionIds?: string[];
}

function loadBrowsePrefsFromStorage(siteIds: string[]): BrowsePrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BROWSE_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BrowsePrefs;
    const siteId =
      parsed.siteId && siteIds.includes(parsed.siteId) ? parsed.siteId : undefined;
    const daysPreset = ["3", "7", "30", "all", "custom"].includes(
      parsed.daysPreset ?? ""
    )
      ? (parsed.daysPreset as DaysFilterPreset)
      : undefined;
    const daysCustom =
      typeof parsed.daysCustom === "number" &&
      !Number.isNaN(parsed.daysCustom) &&
      parsed.daysCustom >= 1
        ? parsed.daysCustom
        : undefined;
    const sectionIds = Array.isArray(parsed.sectionIds)
      ? parsed.sectionIds.filter((id): id is string => typeof id === "string")
      : undefined;
    return { siteId, daysPreset, daysCustom, sectionIds };
  } catch {
    return {};
  }
}

function saveBrowsePrefsToStorage(prefs: BrowsePrefs) {
  try {
    localStorage.setItem(BROWSE_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

type ViewMode = "top" | "normal" | "unfollowed";

interface MeMarketsPageContentProps {
  sites: SiteItem[];
}

export function MeMarketsPageContent({ sites }: MeMarketsPageContentProps) {
  const [followedMarkets, setFollowedMarkets] = useState<MarketItem[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("top");
  const [attentionFilterPreset, setAttentionFilterPreset] = useState<
    AttentionFilterPreset
  >("1");
  const [attentionFilterCustom, setAttentionFilterCustom] = useState(1);

  useEffect(() => {
    const { preset, custom } = loadAttentionFilterFromStorage();
    setAttentionFilterPreset(preset);
    setAttentionFilterCustom(custom);
  }, []);
  const attentionFilter =
    attentionFilterPreset === "custom"
      ? attentionFilterCustom
      : parseInt(attentionFilterPreset, 10);

  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sectionIdsBySite, setSectionIdsBySite] = useState<
    Record<string, Set<string>>
  >({});
  const [sectionsBySite, setSectionsBySite] = useState<
    Record<string, SectionItem[]>
  >({});
  const [loadingSections, setLoadingSections] = useState(false);
  const [browseMarkets, setBrowseMarkets] = useState<MarketItem[]>([]);
  const [loadingCached, setLoadingCached] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseAttentionMap, setBrowseAttentionMap] = useState<
    Record<string, number>
  >({});
  const shouldAutoLoadBrowse = useRef(false);

  const [daysFilterPreset, setDaysFilterPreset] = useState<
    DaysFilterPreset
  >("3");
  const [daysFilterCustom, setDaysFilterCustom] = useState(1);

  useEffect(() => {
    const prefs = loadBrowsePrefsFromStorage(siteIds);
    if (prefs.siteId) {
      setSelectedSiteId(prefs.siteId);
      shouldAutoLoadBrowse.current = true;
    }
    if (prefs.daysPreset) setDaysFilterPreset(prefs.daysPreset);
    if (prefs.daysCustom != null) setDaysFilterCustom(prefs.daysCustom);
    if (prefs.sectionIds && prefs.sectionIds.length > 0 && prefs.siteId) {
      setSectionIdsBySite((prev) => ({
        ...prev,
        [prefs.siteId!]: new Set(prefs.sectionIds!),
      }));
    }
  }, [siteIds]);

  const daysFilter: number | "all" =
    daysFilterPreset === "custom"
      ? daysFilterCustom
      : daysFilterPreset === "all"
        ? "all"
        : parseInt(daysFilterPreset, 10);

  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const fetchBrowseAttentionMap = useCallback(async () => {
    try {
      const res = await fetch("/api/me/market-attention-map");
      const data = await res.json();
      if (res.ok && data && typeof data === "object") {
        setBrowseAttentionMap(data as Record<string, number>);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBrowseAttentionMap();
  }, [fetchBrowseAttentionMap]);

  const fetchFollowedMarkets = useCallback(async () => {
    setLoadingFollowed(true);
    try {
      const url = new URL("/api/me/followed-markets", window.location.origin);
      if (viewMode === "top") {
        url.searchParams.set("mode", "top");
      } else if (viewMode === "unfollowed") {
        url.searchParams.set("unfollowed", "true");
      } else {
        url.searchParams.set("minAttention", String(attentionFilter));
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setFollowedMarkets(data);
      } else {
        setFollowedMarkets([]);
      }
    } catch {
      setFollowedMarkets([]);
    } finally {
      setLoadingFollowed(false);
    }
  }, [viewMode, attentionFilter]);

  useEffect(() => {
    fetchFollowedMarkets();
  }, [fetchFollowedMarkets]);

  const handleAttentionChange = useCallback(
    async (marketId: string, level: number) => {
      try {
        const res = await fetch(`/api/markets/${marketId}/attention`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attentionLevel: level }),
        });
        if (res.ok) {
          setFollowedMarkets((prev) =>
            prev.map((m) =>
              m.id === marketId ? { ...m, attentionLevel: level } : m
            )
          );
          setBrowseAttentionMap((prev) => ({ ...prev, [marketId]: level }));
          fetchFollowedMarkets();
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
    [fetchFollowedMarkets]
  );

  const handleBatchAttentionChange = useCallback(
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
          setBrowseAttentionMap((prev) => ({ ...prev, ...updates }));
          setFollowedMarkets((prev) =>
            prev.map((m) =>
              marketIds.includes(m.id) ? { ...m, attentionLevel: level } : m
            )
          );
          fetchFollowedMarkets();
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
    [fetchFollowedMarkets]
  );

  const followedAttentionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of followedMarkets) {
      if (m.attentionLevel != null) map[m.id] = m.attentionLevel;
    }
    return map;
  }, [followedMarkets]);

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

  const loadCachedMarkets = useCallback(async () => {
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
        `/api/sites/${selectedSiteId}/markets/cached`,
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
              : "获取缓存市场失败";
        setBrowseError(errStr);
        setBrowseMarkets([]);
        toast.error(`加载失败：${errStr}`);
        return;
      }
      const arr = Array.isArray(data) ? data : [];
      setBrowseMarkets(arr);
      toast.success(arr.length > 0 ? `加载成功，共获取 ${arr.length} 条市场` : "加载成功，当前筛选条件下暂无市场");
      if (Array.isArray(data) && data.length > 0) {
        const selected = sectionIdsBySite[selectedSiteId];
        const sections = sectionsBySite[selectedSiteId] ?? [];
        const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
        const idsToSave =
          selected && selected.size > 0
            ? Array.from(selected).filter((id) => enabledIds.includes(id))
            : [];
        saveBrowsePrefsToStorage({
          siteId: selectedSiteId,
          daysPreset: daysFilterPreset,
          daysCustom: daysFilterCustom,
          sectionIds: idsToSave.length > 0 ? idsToSave : undefined,
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "未知错误");
      setBrowseError(`请求失败: ${msg}`);
      setBrowseMarkets([]);
      toast.error(`加载失败：${msg}`);
    } finally {
      setLoadingCached(false);
    }
  }, [
    selectedSiteId,
    sectionsBySite,
    sectionIdsBySite,
    daysFilter,
    daysFilterPreset,
    daysFilterCustom,
  ]);

  useEffect(() => {
    if (
      !selectedSiteId ||
      !shouldAutoLoadBrowse.current ||
      loadingSections ||
      loadingCached
    )
      return;
    const sections = sectionsBySite[selectedSiteId];
    if (!sections || sections.length === 0) return;
    shouldAutoLoadBrowse.current = false;
    loadCachedMarkets();
  }, [
    selectedSiteId,
    sectionsBySite,
    loadingSections,
    loadingCached,
    loadCachedMarkets,
  ]);

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

  const followedSectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of followedMarkets) {
      if (m.sectionName) map[m.sectionId] = m.sectionName;
    }
    return map;
  }, [followedMarkets]);

  const followedSiteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of followedMarkets) {
      if (m.siteName) map[m.siteId] = m.siteName;
    }
    return map;
  }, [followedMarkets]);

  const sections = selectedSiteId ? sectionsBySite[selectedSiteId] ?? [] : [];
  const enabledSections = sections.filter((s) => s.enabled);
  const selectedSections = selectedSiteId ? sectionIdsBySite[selectedSiteId] : undefined;
  const selectedCount =
    selectedSections && selectedSections.size > 0
      ? selectedSections.size
      : enabledSections.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        用户市场
      </h1>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            我的市场
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode("top")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                viewMode === "top"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              我最关注
            </button>
            <button
              type="button"
              onClick={() => setViewMode("normal")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                viewMode === "normal"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              按关注度筛选
            </button>
            <button
              type="button"
              onClick={() => setViewMode("unfollowed")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                viewMode === "unfollowed"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              不再关注
            </button>
          </div>
          {viewMode === "normal" && (
            <div className="ml-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                关注度 ≥
              </span>
              {(["0", "1", "2", "3"] as const).map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="market-attention-filter"
                    checked={attentionFilterPreset === p}
                    onChange={() => {
                      setAttentionFilterPreset(p);
                      saveAttentionFilterToStorage(p, attentionFilterCustom);
                    }}
                    className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                  />
                  {p}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800">
                <input
                  type="radio"
                  name="market-attention-filter"
                  checked={attentionFilterPreset === "custom"}
                  onChange={() => {
                    setAttentionFilterPreset("custom");
                    saveAttentionFilterToStorage("custom", attentionFilterCustom);
                  }}
                  className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                />
                自定义
              </label>
              {attentionFilterPreset === "custom" && (
                <input
                  type="number"
                  min={0}
                  value={attentionFilterCustom}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v >= 0) {
                      setAttentionFilterCustom(v);
                      saveAttentionFilterToStorage("custom", v);
                    }
                  }}
                  className="w-14 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              )}
            </div>
          )}
        </div>

        {loadingFollowed ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">加载中…</p>
          </div>
        ) : followedMarkets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">
              {viewMode === "unfollowed"
                ? "暂无不再关注的市场"
                : "暂无关注市场"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
              前往{" "}
              <Link
                href="/events"
                className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                事件更新
              </Link>{" "}
              点击事件的「更新最近市场」拉取市场，或在下方浏览并设置关注度
            </p>
          </div>
        ) : (
          <MarketsTable
            markets={followedMarkets}
            sectionNameMap={followedSectionNameMap}
            siteNameMap={
              Object.keys(followedSiteNameMap).length > 1
                ? followedSiteNameMap
                : undefined
            }
            attentionMap={followedAttentionMap}
            onAttentionChange={handleAttentionChange}
            onBatchAttentionChange={handleBatchAttentionChange}
            pageSize={10}
            selectable
            enableSelectAll
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
          浏览并关注
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                站点
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <input
                      type="radio"
                      name="browse-market-site"
                      checked={selectedSiteId === site.id}
                      onChange={() => {
                        setSelectedSiteId(site.id);
                        saveBrowsePrefsToStorage({
                          siteId: site.id,
                          daysPreset: daysFilterPreset,
                          daysCustom: daysFilterCustom,
                        });
                      }}
                      className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    />
                    {site.name} ({site.adapterKey})
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                天数范围（截止时间）
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["3", "7", "30", "all"] as const).map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <input
                      type="radio"
                      name="browse-market-days"
                      checked={daysFilterPreset === p}
                      onChange={() => {
                        setDaysFilterPreset(p);
                        if (selectedSiteId) {
                          saveBrowsePrefsToStorage({
                            siteId: selectedSiteId,
                            daysPreset: p,
                            daysCustom: daysFilterCustom,
                          });
                        }
                      }}
                      className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    />
                    {p === "all" ? "全部" : `${p}天`}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800">
                  <input
                    type="radio"
                    name="browse-market-days"
                    checked={daysFilterPreset === "custom"}
                    onChange={() => {
                      setDaysFilterPreset("custom");
                      if (selectedSiteId) {
                        saveBrowsePrefsToStorage({
                          siteId: selectedSiteId,
                          daysPreset: "custom",
                          daysCustom: daysFilterCustom,
                        });
                      }
                    }}
                    className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
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
                          if (selectedSiteId) {
                            saveBrowsePrefsToStorage({
                              siteId: selectedSiteId,
                              daysPreset: "custom",
                              daysCustom: v,
                            });
                          }
                        }
                      }}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      天
                    </span>
                  </>
                )}
              </div>
            </div>

            {selectedSiteId && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {siteMap.get(selectedSiteId)?.name ?? selectedSiteId}
                  </span>
                  <button
                    type="button"
                    onClick={loadCachedMarkets}
                    disabled={loadingSections || loadingCached}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    {loadingCached ? "加载中…" : "加载"}
                  </button>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    板块筛选：
                    {selectedCount === 0 || selectedCount === enabledSections.length
                      ? "全部已启用板块"
                      : `已选 ${selectedCount} 个`}
                  </span>
                  {loadingSections ? (
                    <p className="mt-1 text-sm text-slate-500">加载板块中…</p>
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
                              !selectedSections ||
                              selectedSections.size === 0 ||
                              selectedSections.has(sec.id)
                            }
                            onChange={() => toggleSection(selectedSiteId, sec.id)}
                            className="h-3.5 w-3.5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
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
            )}

            {browseError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {browseError}
              </p>
            )}
          </div>
        </div>

        <MarketsTable
          markets={browseMarkets}
          sectionNameMap={browseSectionNameMap}
          siteNameMap={undefined}
          attentionMap={browseAttentionMap}
          onAttentionChange={handleAttentionChange}
          onBatchAttentionChange={handleBatchAttentionChange}
          pageSize={10}
          selectable
          enableSelectAll
          emptyStateMessage={
            !selectedSiteId
              ? "请选择站点和板块后点击加载"
              : loadingCached
                ? "加载中…"
                : "该站点/板块暂无缓存市场，请先在事件更新页面点击「更新最近市场」"
          }
          emptyStateSubMessage={
            !selectedSiteId || loadingCached
              ? undefined
              : "请先在事件更新页面更新事件后，点击各事件的「更新最近市场」拉取市场。"
          }
        />
      </div>
    </div>
  );
}
