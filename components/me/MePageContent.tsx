"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  EventsTable,
  type EventItem,
} from "@/components/events-table/EventsTable";
import {
  MarketsTable,
  type MarketItem,
} from "@/components/markets-table/MarketsTable";
import type { SiteItem, SectionItem } from "@/components/events-table/EventsPageContent";

const ATTENTION_FILTER_STORAGE_KEY = "me-page-attention-filter";
const TOP_DAYS_FILTER_STORAGE_KEY = "me-page-top-days-filter";
const NORMAL_DAYS_FILTER_STORAGE_KEY = "me-page-normal-days-filter";
const UNFOLLOWED_DAYS_FILTER_STORAGE_KEY = "me-page-unfollowed-days-filter";
const BROWSE_PREFS_STORAGE_KEY = "me-page-browse-prefs";

type AttentionFilterPreset = "0" | "1" | "2" | "3" | "4" | "5" | "custom";
type DaysFilterPreset = "3" | "7" | "14" | "30" | "all" | "custom";

function loadAttentionFilterFromStorage(): {
  preset: AttentionFilterPreset;
  custom: number;
} {
  if (typeof window === "undefined") return { preset: "1", custom: 1 };
  try {
    const raw = localStorage.getItem(ATTENTION_FILTER_STORAGE_KEY);
    if (!raw) return { preset: "1", custom: 1 };
    const parsed = JSON.parse(raw) as { preset?: string; custom?: number };
    const preset = ["0", "1", "2", "3", "4", "5", "custom"].includes(parsed?.preset ?? "")
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

function loadDaysFromStorage(storageKey: string): {
  preset: DaysFilterPreset;
  custom: number;
} {
  if (typeof window === "undefined") return { preset: "all", custom: 1 };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { preset: "all", custom: 1 };
    const parsed = JSON.parse(raw) as { preset?: string; custom?: number };
    const preset = ["3", "7", "14", "30", "all", "custom"].includes(
      parsed?.preset ?? ""
    )
      ? (parsed.preset as DaysFilterPreset)
      : "all";
    const custom =
      typeof parsed?.custom === "number" &&
      !Number.isNaN(parsed.custom) &&
      parsed.custom >= 1
        ? parsed.custom
        : 1;
    return { preset, custom };
  } catch {
    return { preset: "all", custom: 1 };
  }
}

function saveDaysToStorage(
  storageKey: string,
  preset: DaysFilterPreset,
  custom: number
) {
  try {
    localStorage.setItem(
      storageKey,
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
    const daysPreset = ["3", "7", "14", "30", "all", "custom"].includes(
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

/** Event from GET /api/me/followed-events (includes siteName, sectionName, attentionLevel). */
type FollowedEventItem = EventItem & {
  siteName?: string;
  sectionName?: string;
  attentionLevel?: number;
};

type ViewMode = "top" | "normal" | "unfollowed";

interface MePageContentProps {
  sites: SiteItem[];
}

export function MePageContent({ sites }: MePageContentProps) {
  const [followedEvents, setFollowedEvents] = useState<FollowedEventItem[]>([]);
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

  const [topDaysPreset, setTopDaysPreset] = useState<DaysFilterPreset>("all");
  const [topDaysCustom, setTopDaysCustom] = useState(1);
  const [normalDaysPreset, setNormalDaysPreset] = useState<DaysFilterPreset>("all");
  const [normalDaysCustom, setNormalDaysCustom] = useState(1);
  const [unfollowedDaysPreset, setUnfollowedDaysPreset] =
    useState<DaysFilterPreset>("all");
  const [unfollowedDaysCustom, setUnfollowedDaysCustom] = useState(1);

  useEffect(() => {
    const top = loadDaysFromStorage(TOP_DAYS_FILTER_STORAGE_KEY);
    const normal = loadDaysFromStorage(NORMAL_DAYS_FILTER_STORAGE_KEY);
    const unfollowed = loadDaysFromStorage(UNFOLLOWED_DAYS_FILTER_STORAGE_KEY);
    setTopDaysPreset(top.preset);
    setTopDaysCustom(top.custom);
    setNormalDaysPreset(normal.preset);
    setNormalDaysCustom(normal.custom);
    setUnfollowedDaysPreset(unfollowed.preset);
    setUnfollowedDaysCustom(unfollowed.custom);
  }, []);

  const attentionFilter =
    attentionFilterPreset === "custom"
      ? attentionFilterCustom
      : parseInt(attentionFilterPreset, 10);

  const toDaysFilter = (
    preset: DaysFilterPreset,
    custom: number
  ): number | "all" =>
    preset === "custom"
      ? (Number.isFinite(custom) && custom >= 1
          ? Math.min(365, Math.floor(custom))
          : 7)
      : preset === "all"
        ? "all"
        : parseInt(preset, 10) || 7;

  const topDaysFilter = toDaysFilter(topDaysPreset, topDaysCustom);
  const normalDaysFilter = toDaysFilter(normalDaysPreset, normalDaysCustom);
  const unfollowedDaysFilter = toDaysFilter(
    unfollowedDaysPreset,
    unfollowedDaysCustom
  );

  const followedDaysFilter =
    viewMode === "top"
      ? topDaysFilter
      : viewMode === "normal"
        ? normalDaysFilter
        : unfollowedDaysFilter;

  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);
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
  const [browseAttentionMap, setBrowseAttentionMap] = useState<
    Record<string, number>
  >({});
  const [newMarkets, setNewMarkets] = useState<MarketItem[]>([]);
  const [changedMarkets, setChangedMarkets] = useState<MarketItem[]>([]);
  const [marketAttentionMap, setMarketAttentionMap] = useState<
    Record<string, number>
  >({});
  const shouldAutoLoadBrowse = useRef(false);

  const [daysFilterPreset, setDaysFilterPreset] = useState<
    DaysFilterPreset
  >("3");
  const [daysFilterCustom, setDaysFilterCustom] = useState(1);

  /* Restore browse prefs from storage on mount */
  useEffect(() => {
    const prefs = loadBrowsePrefsFromStorage(siteIds);
    if (prefs.siteId) {
      setSelectedSiteId(prefs.siteId);
      shouldAutoLoadBrowse.current = true;
    }
    if (prefs.daysPreset) setDaysFilterPreset(prefs.daysPreset);
    if (prefs.daysCustom != null) setDaysFilterCustom(prefs.daysCustom);
    const siteId = prefs.siteId;
    const sectionIds = prefs.sectionIds;
    if (siteId && sectionIds && sectionIds.length > 0) {
      setSectionIdsBySite((prev) => ({
        ...prev,
        [siteId]: new Set(sectionIds),
      }));
    }
  }, [siteIds]);

  const daysFilter: number | "all" =
    daysFilterPreset === "custom"
      ? (Number.isFinite(daysFilterCustom) && daysFilterCustom >= 1
          ? Math.min(365, Math.floor(daysFilterCustom))
          : 7)
      : daysFilterPreset === "all"
        ? "all"
        : parseInt(daysFilterPreset, 10) || 7;

  const siteMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const fetchBrowseAttentionMap = useCallback(async () => {
    try {
      const res = await fetch("/api/me/attention-map");
      const data = await res.json();
      if (res.ok && data && typeof data === "object") {
        setBrowseAttentionMap(data as Record<string, number>);
      }
    } catch (err) {
      console.warn("[MePageContent] fetchBrowseAttentionMap failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchBrowseAttentionMap();
  }, [fetchBrowseAttentionMap]);

  const fetchMarketAttentionMap = useCallback(async () => {
    try {
      const res = await fetch("/api/me/market-attention-map");
      const data = await res.json();
      if (res.ok && data && typeof data === "object") {
        setMarketAttentionMap(data as Record<string, number>);
      }
    } catch (err) {
      console.warn("[MePageContent] fetchMarketAttentionMap failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchMarketAttentionMap();
  }, [fetchMarketAttentionMap]);

  const fetchFollowedEvents = useCallback(async () => {
    setLoadingFollowed(true);
    try {
      const url = new URL("/api/me/followed-events", window.location.origin);
      if (viewMode === "top") {
        url.searchParams.set("mode", "top");
      } else if (viewMode === "unfollowed") {
        url.searchParams.set("unfollowed", "true");
      } else {
        url.searchParams.set("minAttention", String(attentionFilter));
      }
      url.searchParams.set(
        "days",
        followedDaysFilter === "all" ? "all" : String(followedDaysFilter)
      );
      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setFollowedEvents(data);
      } else {
        setFollowedEvents([]);
      }
    } catch {
      setFollowedEvents([]);
    } finally {
      setLoadingFollowed(false);
    }
  }, [viewMode, attentionFilter, followedDaysFilter]);

  useEffect(() => {
    fetchFollowedEvents();
  }, [fetchFollowedEvents]);

  const handleAttentionChange = useCallback(
    async (eventId: string, level: number) => {
      try {
        const res = await fetch(`/api/events/${eventId}/attention`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attentionLevel: level }),
        });
        if (res.ok) {
          setFollowedEvents((prev) =>
            prev.map((e) =>
              e.id === eventId ? { ...e, attentionLevel: level } : e
            )
          );
          setBrowseAttentionMap((prev) => ({ ...prev, [eventId]: level }));
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
            updates: eventIds.map((eventId) => ({ eventId, attentionLevel: level })),
          }),
        });
        if (res.ok) {
          const updates: Record<string, number> = {};
          for (const id of eventIds) updates[id] = level;
          setBrowseAttentionMap((prev) => ({ ...prev, ...updates }));
          setFollowedEvents((prev) =>
            prev.map((e) =>
              eventIds.includes(e.id) ? { ...e, attentionLevel: level } : e
            )
          );
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

  const handleUpdateMarkets = useCallback(async (eventId: string) => {
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
          for (const m of apiNew) byId.set(m.id, m as MarketItem);
          return Array.from(byId.values());
        });
        setChangedMarkets((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of apiChanged) byId.set(m.id, m as MarketItem);
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
  }, []);

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

  const followedAttentionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of followedEvents) {
      if (e.attentionLevel != null) map[e.id] = e.attentionLevel;
    }
    return map;
  }, [followedEvents]);

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
        toast.error(`加载失败：${errStr}`);
        return;
      }
      const arr = Array.isArray(data) ? data : [];
      setBrowseEvents(arr);
      toast.success(arr.length > 0 ? `加载成功，共获取 ${arr.length} 条事件` : "加载成功，当前筛选条件下暂无事件");
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
      setBrowseEvents([]);
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

  /* Auto-load browse events when restored from storage and sections are ready */
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
    loadCachedEvents();
  }, [
    selectedSiteId,
    sectionsBySite,
    loadingSections,
    loadingCached,
    loadCachedEvents,
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

  /** Exclude events with attention 0 from browse table display. */
  const browseEventsFiltered = useMemo(() => {
    return browseEvents.filter(
      (e) => (e.attentionLevel ?? browseAttentionMap[e.id] ?? 1) !== 0
    );
  }, [browseEvents, browseAttentionMap]);

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

  const marketsSectionNameMap = useMemo(
    () => ({ ...followedSectionNameMap, ...browseSectionNameMap }),
    [followedSectionNameMap, browseSectionNameMap]
  );

  const marketsSiteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sites) {
      map[s.id] = s.name;
    }
    return map;
  }, [sites]);

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
        用户事件
      </h1>

      <div className="space-y-4 rounded-lg border-l-4 border-blue-500 bg-blue-50/50 p-4 dark:border-blue-400 dark:bg-blue-500/10">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            我的事件
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            你已关注的事件，可按关注度与天数筛选
          </p>
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
              {(["0", "1", "2", "3", "4", "5"] as const).map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="attention-filter"
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
                  name="attention-filter"
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
          <div className="ml-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              天数范围（最近交易截止时间）
            </span>
            {(["3", "7", "14", "30", "all"] as const).map((p) => {
              const preset =
                viewMode === "top"
                  ? topDaysPreset
                  : viewMode === "normal"
                    ? normalDaysPreset
                    : unfollowedDaysPreset;
              const custom =
                viewMode === "top"
                  ? topDaysCustom
                  : viewMode === "normal"
                    ? normalDaysCustom
                    : unfollowedDaysCustom;
              const storageKey =
                viewMode === "top"
                  ? TOP_DAYS_FILTER_STORAGE_KEY
                  : viewMode === "normal"
                    ? NORMAL_DAYS_FILTER_STORAGE_KEY
                    : UNFOLLOWED_DAYS_FILTER_STORAGE_KEY;
              const setPreset =
                viewMode === "top"
                  ? setTopDaysPreset
                  : viewMode === "normal"
                    ? setNormalDaysPreset
                    : setUnfollowedDaysPreset;
              const setCustom =
                viewMode === "top"
                  ? setTopDaysCustom
                  : viewMode === "normal"
                    ? setNormalDaysCustom
                    : setUnfollowedDaysCustom;
              return (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="followed-days-filter"
                    checked={preset === p}
                    onChange={() => {
                      setPreset(p);
                      saveDaysToStorage(storageKey, p, custom);
                    }}
                    className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                  />
                  {p === "all" ? "全部" : `${p}天`}
                </label>
              );
            })}
            {(() => {
              const preset =
                viewMode === "top"
                  ? topDaysPreset
                  : viewMode === "normal"
                    ? normalDaysPreset
                    : unfollowedDaysPreset;
              const custom =
                viewMode === "top"
                  ? topDaysCustom
                  : viewMode === "normal"
                    ? normalDaysCustom
                    : unfollowedDaysCustom;
              const storageKey =
                viewMode === "top"
                  ? TOP_DAYS_FILTER_STORAGE_KEY
                  : viewMode === "normal"
                    ? NORMAL_DAYS_FILTER_STORAGE_KEY
                    : UNFOLLOWED_DAYS_FILTER_STORAGE_KEY;
              const setPreset =
                viewMode === "top"
                  ? setTopDaysPreset
                  : viewMode === "normal"
                    ? setNormalDaysPreset
                    : setUnfollowedDaysPreset;
              const setCustom =
                viewMode === "top"
                  ? setTopDaysCustom
                  : viewMode === "normal"
                    ? setNormalDaysCustom
                    : setUnfollowedDaysCustom;
              return (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800">
                    <input
                      type="radio"
                      name="followed-days-filter"
                      checked={preset === "custom"}
                      onChange={() => {
                        setPreset("custom");
                        saveDaysToStorage(storageKey, "custom", custom);
                      }}
                      className="h-3.5 w-3.5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                    />
                    自定义
                  </label>
                  {preset === "custom" && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={custom}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v >= 1) {
                            const clamped = Math.min(365, v);
                            setCustom(clamped);
                            saveDaysToStorage(storageKey, "custom", clamped);
                          }
                        }}
                        className="w-14 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        天
                      </span>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {loadingFollowed ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">加载中…</p>
          </div>
        ) : followedEvents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">
              {viewMode === "unfollowed"
                ? "暂无不再关注的事件"
                : "暂无关注事件"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
              前往{" "}
              <Link
                href="/events"
                className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                事件更新
              </Link>{" "}
              或在下方浏览并设置关注度
            </p>
          </div>
        ) : (
          <EventsTable
            events={followedEvents}
            sectionNameMap={followedSectionNameMap}
            browseContextHint="正在浏览你关注的事件"
            siteNameMap={
              Object.keys(followedSiteNameMap).length > 1
                ? followedSiteNameMap
                : undefined
            }
            attentionMap={followedAttentionMap}
            onAttentionChange={handleAttentionChange}
            onBatchAttentionChange={handleBatchAttentionChange}
            onUpdateMarkets={handleUpdateMarkets}
            onBatchUpdateMarkets={handleBatchUpdateMarkets}
            pageSize={10}
            selectable
            enableSelectAll
          />
        )}
      </div>

      <div
        id="browse-and-follow"
        className="mt-8 space-y-4 border-t border-slate-200 pt-6 dark:border-slate-700"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            浏览并关注
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            从站点缓存中浏览并设置关注度，用于发现新内容
          </p>
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
                      name="browse-site"
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
                天数范围（最近交易截止时间）
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["3", "7", "14", "30", "all"] as const).map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <input
                      type="radio"
                      name="browse-days"
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
                    name="browse-days"
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
                    onClick={loadCachedEvents}
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

        <EventsTable
          events={browseEventsFiltered}
          sectionNameMap={browseSectionNameMap}
          browseContextHint="正在浏览站点缓存中的事件"
          siteNameMap={undefined}
          attentionMap={browseAttentionMap}
          onAttentionChange={handleAttentionChange}
          onBatchAttentionChange={handleBatchAttentionChange}
          onUpdateMarkets={handleUpdateMarkets}
          onBatchUpdateMarkets={handleBatchUpdateMarkets}
          pageSize={10}
          selectable
          enableSelectAll
          emptyStateMessage={
            !selectedSiteId
              ? "请选择站点和板块后点击加载"
              : loadingCached
                ? "加载中…"
                : "该站点/板块暂无缓存事件，请先在事件更新页面更新"
          }
          emptyStateSubMessage={
            !selectedSiteId || loadingCached
              ? undefined
              : "请先在事件更新页面点击「更新」拉取事件。"
          }
        />

      {newMarkets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            新增市场
          </h2>
          <MarketsTable
            markets={newMarkets}
            sectionNameMap={marketsSectionNameMap}
            siteNameMap={sites.length > 1 ? marketsSiteNameMap : undefined}
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
            sectionNameMap={marketsSectionNameMap}
            siteNameMap={sites.length > 1 ? marketsSiteNameMap : undefined}
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
    </div>
  );
}
