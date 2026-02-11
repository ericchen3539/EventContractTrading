"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { SiteOptionsSelector, type SiteOption } from "./SiteOptionsSelector";
import { SectionOptionsSelector, type SectionOption } from "./SectionOptionsSelector";
import { EventsTable, type EventItem } from "@/components/events-table/EventsTable";

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

interface MePageContentProps {
  sites: SiteItem[];
}

/** Check if site selection has at least one non-blank. */
function hasNonBlankSite(selected: Set<SiteOption>): boolean {
  return selected.has("kalshi") || selected.has("polymarket");
}

/** Check if section selection has at least one non-blank. */
function hasNonBlankSection(selected: Set<SectionOption>): boolean {
  return selected.has("politics") || selected.has("other");
}

export function MePageContent({ sites }: MePageContentProps) {
  const [selectedSites, setSelectedSites] = useState<Set<SiteOption>>(new Set([""]));
  const [selectedSections, setSelectedSections] = useState<Set<SectionOption>>(new Set([""]));
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kalshiSite = useMemo(
    () => sites.find((s) => s.adapterKey === "kalshi"),
    [sites]
  );

  const hasPolymarketSelected = selectedSites.has("polymarket");
  const hasKalshiSelected = selectedSites.has("kalshi");
  const showEvents =
    hasNonBlankSite(selectedSites) &&
    hasNonBlankSection(selectedSections);

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
    } catch {
      setError("获取板块失败");
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    if (kalshiSite && hasKalshiSelected) {
      fetchSections(kalshiSite.id);
    } else {
      setSections([]);
    }
  }, [kalshiSite?.id, hasKalshiSelected, fetchSections]);

  const fetchEvents = useCallback(async () => {
    if (!kalshiSite) {
      setError("请先在站点管理添加 Kalshi 站点");
      return;
    }
    setError(null);
    setLoadingEvents(true);
    setEvents([]);
    try {
      const url = new URL(`/api/sites/${kalshiSite.id}/events`, window.location.origin);
      const enabledIds = sections.filter((s) => s.enabled).map((s) => s.id);
      if (enabledIds.length > 0) {
        url.searchParams.set("sectionIds", enabledIds.join(","));
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
  }, [kalshiSite, sections]);

  const showOtherPlaceholder =
    showEvents &&
    selectedSections.has("other") &&
    !selectedSections.has("politics") &&
    hasKalshiSelected &&
    !!kalshiSite;

  const shouldFetchKalshiEvents =
    showEvents &&
    hasKalshiSelected &&
    !!kalshiSite &&
    selectedSections.has("politics") &&
    !showOtherPlaceholder;

  useEffect(() => {
    if (shouldFetchKalshiEvents) {
      fetchEvents();
    } else {
      setEvents([]);
      setError(null);
    }
  }, [shouldFetchKalshiEvents, fetchEvents]);

  const sectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sections) {
      map[s.id] = s.name;
    }
    return map;
  }, [sections]);

  const showPolymarketPlaceholder =
    showEvents && hasPolymarketSelected && !hasKalshiSelected;
  const showKalshiPrompt = showEvents && hasKalshiSelected && !kalshiSite;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        我的
      </h1>

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap gap-6">
          <SiteOptionsSelector selected={selectedSites} onChange={setSelectedSites} />
          <SectionOptionsSelector
            selected={selectedSections}
            onChange={setSelectedSections}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          板块事件
        </h2>

        {!showEvents && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              请选择「我的站点」和「我的板块」中的非空白选项，以查看可交易事件。
            </p>
          </div>
        )}

        {showEvents && showKalshiPrompt && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              请先在{" "}
              <Link
                href="/sites/new"
                className="font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
              >
                站点管理
              </Link>{" "}
              添加 Kalshi 站点。
            </p>
          </div>
        )}

        {showEvents && showPolymarketPlaceholder && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              PolyMarket 即将支持
            </p>
          </div>
        )}

        {showEvents && showOtherPlaceholder && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              其他板块即将支持
            </p>
          </div>
        )}

        {showEvents &&
          hasKalshiSelected &&
          kalshiSite &&
          selectedSections.has("politics") &&
          !showOtherPlaceholder && (
            <>
              {hasPolymarketSelected && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  PolyMarket 即将支持
                </p>
              )}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={fetchEvents}
                  disabled={loadingEvents || loadingSections}
                  className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {loadingEvents ? "拉取中…" : "刷新"}
                </button>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <EventsTable events={events} sectionNameMap={sectionNameMap} />
            </>
          )}
      </div>
    </div>
  );
}
