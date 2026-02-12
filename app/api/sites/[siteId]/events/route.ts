/**
 * Events API: GET — fetch events from adapter, upsert to EventCache, return JSON.
 * Requires auth and site ownership. Optional ?sectionIds=id1,id2 to filter sections.
 */
import { NextRequest, NextResponse } from "next/server";

/** Pro plan: 300s max. Kalshi returns many events; sequential upserts need full duration. */
export const maxDuration = 300;
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

function toPublicEvent(event: {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description: string | null;
  endDate: Date | null;
  volume: number | null;
  liquidity: number | null;
  outcomes: unknown;
  fetchedAt: Date;
}) {
  return {
    id: event.id,
    siteId: event.siteId,
    sectionId: event.sectionId,
    externalId: event.externalId,
    title: event.title,
    description: event.description ?? undefined,
    endDate: event.endDate?.toISOString() ?? undefined,
    volume: event.volume ?? undefined,
    liquidity: event.liquidity ?? undefined,
    outcomes: event.outcomes ?? undefined,
    fetchedAt: event.fetchedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ siteId: string }> }
) {
  try {
    return await handleGet(request, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
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
      where: { siteId },
      orderBy: { fetchedAt: "desc" },
    });
    return NextResponse.json(cached.map(toPublicEvent));
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
    const msg = err instanceof Error ? err.message : "Adapter fetch failed";
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

  const TX_TIMEOUT_MS = 180_000; // 3 min; Pro allows 300s, leave headroom for Kalshi fetch + response
  await prisma.$transaction(
    async (tx) => {
    for (const ev of adapterEvents) {
      const section = externalToSection.get(ev.sectionExternalId);
      if (!section) continue;

      await tx.eventCache.upsert({
        where: {
          siteId_sectionId_externalId: {
            siteId,
            sectionId: section.id,
            externalId: ev.externalId,
          },
        },
        create: {
          siteId,
          sectionId: section.id,
          externalId: ev.externalId,
          title: ev.title,
          description: ev.description ?? null,
          endDate: ev.endDate ?? null,
          volume: ev.volume ?? null,
          liquidity: ev.liquidity ?? null,
          outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
          raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
        },
        update: {
          title: ev.title,
          description: ev.description ?? null,
          endDate: ev.endDate ?? null,
          volume: ev.volume ?? null,
          liquidity: ev.liquidity ?? null,
          outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
          raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
      });
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

  const events = await prisma.eventCache.findMany({
    where: {
      siteId,
      sectionId: { in: Array.from(syncedSectionIds) },
    },
    orderBy: [{ sectionId: "asc" }, { fetchedAt: "desc" }],
  });

  return NextResponse.json(events.map(toPublicEvent));
}
