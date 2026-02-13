/**
 * Events API: GET — fetch events from adapter, classify as new/changed/unchanged,
 * selective upsert (insert new, update changed, skip unchanged), return newEvents + changedEvents.
 * Requires auth and site ownership. Optional ?sectionIds=id1,id2 to filter sections.
 */
import { NextRequest, NextResponse } from "next/server";

/** Pro plan: 300s max. Kalshi returns many events; sequential upserts need full duration. */
export const maxDuration = 300;
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import type { EventMarketInput } from "@/lib/adapters/types";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { toPublicEvent } from "@/lib/api-transform";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { hasSemanticChanges } from "@/lib/events/event-compare";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ siteId: string }> }
) {
  try {
    return await handleGet(request, ctx);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[events] Unhandled error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const site = await getSiteForUser(siteId, session.user.id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const adapter = getAdapter(site.adapterKey);
  if (!adapter) {
    return NextResponse.json(
      { error: `Unknown adapter: ${site.adapterKey}` },
      { status: 400 }
    );
  }

  let sections = await prisma.section.findMany({
    where: { siteId, enabled: true },
    orderBy: { name: "asc" },
  });

  const { searchParams } = new URL(request.url);
  const sectionIdsParam = searchParams.get("sectionIds");
  if (sectionIdsParam) {
    const ids = sectionIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length) {
      sections = sections.filter((s) => ids.includes(s.id));
    }
  }

  if (sections.length === 0) {
    const cached = await prisma.eventCache.findMany({
      where: {
        siteId,
        OR: [
          { status: { in: ["open", "active"] } },
          { status: null },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      newEvents: [],
      changedEvents: cached.map(toPublicEvent),
    });
  }

  const sectionExternalIds = sections.map((s) => s.externalId);
  const externalToSection = new Map(sections.map((s) => [s.externalId, s]));

  const siteInput = {
    id: site.id,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
  };

  let adapterEvents;
  try {
    adapterEvents = await adapter.getEventsAndMarkets(siteInput, sectionExternalIds);
  } catch (err) {
    const msg = getSafeErrorMessage(err, "Adapter fetch failed");
    console.error("[events] Adapter fetch failed:", {
      siteId,
      adapterKey: site.adapterKey,
      sectionCount: sectionExternalIds.length,
      error: err,
    });
    return NextResponse.json(
      { error: `Failed to fetch events: ${msg}` },
      { status: 502 }
    );
  }

  const syncedSectionIds = new Set(sections.map((s) => s.id));

  const newEvents: Awaited<ReturnType<typeof prisma.eventCache.findMany>> = [];
  const changedEvents: Awaited<ReturnType<typeof prisma.eventCache.findMany>> = [];

  const TX_TIMEOUT_MS = 180_000; // 3 min; Pro allows 300s, leave headroom for Kalshi fetch + response
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.eventCache.findMany({
        where: { siteId, sectionId: { in: Array.from(syncedSectionIds) } },
      });
      const existingMap = new Map(
        existing.map((e) => [`${e.sectionId}:${e.externalId}`, e])
      );

      for (const ev of adapterEvents) {
        const section = externalToSection.get(ev.sectionExternalId);
        if (!section) continue;

        const key = `${section.id}:${ev.externalId}`;
        const existingRecord = existingMap.get(key);

        if (!existingRecord) {
          const created = await tx.eventCache.create({
            data: {
              siteId,
              sectionId: section.id,
              externalId: ev.externalId,
              title: ev.title,
              description: ev.description ?? null,
              status: ev.status ?? null,
              createdAt: ev.createdAt ?? null,
              endDate: ev.endDate ?? null,
              volume: ev.volume ?? null,
              liquidity: ev.liquidity ?? null,
              outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
              raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
            },
          });
          newEvents.push(created);
        } else if (hasSemanticChanges(ev, existingRecord)) {
          const updated = await tx.eventCache.update({
            where: {
              siteId_sectionId_externalId: {
                siteId,
                sectionId: section.id,
                externalId: ev.externalId,
              },
            },
            data: {
              title: ev.title,
              description: ev.description ?? null,
              status: ev.status ?? null,
              createdAt: ev.createdAt ?? null,
              endDate: ev.endDate ?? null,
              volume: ev.volume ?? null,
              liquidity: ev.liquidity ?? null,
              outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
              raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
              fetchedAt: new Date(),
            },
          });
          changedEvents.push(updated);
        }
      }

      for (const sec of sections) {
        const fetchedForSection = adapterEvents
          .filter((e) => e.sectionExternalId === sec.externalId)
          .map((e) => e.externalId);
        const externalIds = new Set(fetchedForSection);
        if (externalIds.size > 0) {
          await tx.eventCache.deleteMany({
            where: {
              siteId,
              sectionId: sec.id,
              externalId: { notIn: Array.from(externalIds) },
            },
          });
        } else {
          await tx.eventCache.deleteMany({
            where: { siteId, sectionId: sec.id },
          });
        }
      }
    },
    { timeout: TX_TIMEOUT_MS }
  );

  const sortedNew = [...newEvents].sort((a, b) => {
    const aT = a.createdAt?.getTime() ?? Infinity;
    const bT = b.createdAt?.getTime() ?? Infinity;
    return aT - bT;
  });
  const sortedChanged = [...changedEvents].sort((a, b) => {
    const aT = a.createdAt?.getTime() ?? Infinity;
    const bT = b.createdAt?.getTime() ?? Infinity;
    return aT - bT;
  });

  return NextResponse.json({
    newEvents: sortedNew.map(toPublicEvent),
    changedEvents: sortedChanged.map(toPublicEvent),
  });
}
