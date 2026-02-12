"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { EventsTable, type EventItem } from "@/components/events-table/EventsTable";

/** Event from GET /api/me/followed-events (includes siteName, sectionName). */
type FollowedEventItem = EventItem & {
  siteName?: string;
  sectionName?: string;
};

export function MePageContent() {
  const [events, setEvents] = useState<FollowedEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const fetchFollowedEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/followed-events");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEvents(data);
        setFollowedIds(new Set(data.map((e: FollowedEventItem) => e.id)));
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
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
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      }
    } catch {
      // ignore
    }
  }, []);

  const sectionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of events) {
      if (e.sectionName) map[e.sectionId] = e.sectionName;
    }
    return map;
  }, [events]);

  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of events) {
      if (e.siteName) map[e.siteId] = e.siteName;
    }
    return map;
  }, [events]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        我的
      </h1>

      <div className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          我的事件
        </h2>

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">加载中…</p>
          </div>
        ) : events.length === 0 ? (
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
              添加关注
            </p>
          </div>
        ) : (
          <EventsTable
            events={events}
            sectionNameMap={sectionNameMap}
            siteNameMap={Object.keys(siteNameMap).length > 1 ? siteNameMap : undefined}
            followedIds={followedIds}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        )}
      </div>
    </div>
  );
}
