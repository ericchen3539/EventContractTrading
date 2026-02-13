/**
 * PUT /api/events/[eventId]/markets/update
 * Fetch markets for the event whose close_time equals event.createdAt,
 * upsert to MarketCache, return newMarkets and changedMarkets.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import type { MarketInput } from "@/lib/adapters/types";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";

function hasMarketSemanticChanges(
  input: MarketInput,
  existing: {
    closeTime: Date | null;
    volume: number | null;
    liquidity: number | null;
    outcomes: unknown;
  }
): boolean {
  const inClose = input.closeTime?.getTime() ?? null;
  const exClose = existing.closeTime?.getTime() ?? null;
  if (inClose !== exClose) return true;

  const inVol = input.volume ?? null;
  const exVol = existing.volume ?? null;
  if (inVol !== exVol) return true;

  const inLiq = input.liquidity ?? null;
  const exLiq = existing.liquidity ?? null;
  if (inLiq !== exLiq) return true;

  const inOut = JSON.stringify(input.outcomes ?? {});
  const exOut = JSON.stringify(existing.outcomes ?? {});
  if (inOut !== exOut) return true;

  return false;
}

function toPublicMarket(
  market: {
    id: string;
    eventCacheId: string;
    siteId: string;
    sectionId: string;
    externalId: string;
    title: string;
    closeTime: Date | null;
    volume: number | null;
    liquidity: number | null;
    outcomes: unknown;
    fetchedAt: Date;
  },
  eventTitle: string
) {
  return {
    id: market.id,
    eventCacheId: market.eventCacheId,
    siteId: market.siteId,
    sectionId: market.sectionId,
    externalId: market.externalId,
    title: market.title,
    eventTitle,
    closeTime: market.closeTime?.toISOString() ?? undefined,
    volume: market.volume ?? undefined,
    liquidity: market.liquidity ?? undefined,
    outcomes: market.outcomes ?? undefined,
    fetchedAt: market.fetchedAt.toISOString(),
  };
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const event = await prisma.eventCache.findUnique({
      where: { id: eventId },
      include: { site: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.site.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adapter = getAdapter(event.site.adapterKey);
    if (!adapter) {
      return NextResponse.json(
        { error: `Unknown adapter: ${event.site.adapterKey}` },
        { status: 400 }
      );
    }

    const siteInput = {
      id: event.site.id,
      baseUrl: event.site.baseUrl,
      adapterKey: event.site.adapterKey,
    };

    let markets: MarketInput[];
    try {
      markets = await adapter.getMarketsForEvent(
        siteInput,
        event.externalId,
        event.createdAt
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Adapter fetch failed";
      console.error("[markets/update] Adapter fetch failed:", { eventId, err });
      return NextResponse.json(
        { error: `Failed to fetch markets: ${msg}` },
        { status: 502 }
      );
    }

    const newMarkets: Awaited<ReturnType<typeof prisma.marketCache.create>>[] = [];
    const changedMarkets: Awaited<ReturnType<typeof prisma.marketCache.update>>[] = [];

    const existing = await prisma.marketCache.findMany({
      where: { eventCacheId: eventId },
    });
    const existingMap = new Map(existing.map((m) => [m.externalId, m]));

    for (const m of markets) {
      const existingRecord = existingMap.get(m.externalId);

      if (!existingRecord) {
        const created = await prisma.marketCache.create({
          data: {
            eventCacheId: eventId,
            siteId: event.siteId,
            sectionId: event.sectionId,
            externalId: m.externalId,
            title: m.title,
            closeTime: m.closeTime ?? null,
            volume: m.volume ?? null,
            liquidity: m.liquidity ?? null,
            outcomes: (m.outcomes ?? undefined) as Prisma.InputJsonValue,
            raw: (m.raw ?? undefined) as Prisma.InputJsonValue,
          },
        });
        newMarkets.push(created);
      } else if (
        hasMarketSemanticChanges(m, {
          closeTime: existingRecord.closeTime,
          volume: existingRecord.volume,
          liquidity: existingRecord.liquidity,
          outcomes: existingRecord.outcomes,
        })
      ) {
        const updated = await prisma.marketCache.update({
          where: { id: existingRecord.id },
          data: {
            title: m.title,
            closeTime: m.closeTime ?? null,
            volume: m.volume ?? null,
            liquidity: m.liquidity ?? null,
            outcomes: (m.outcomes ?? undefined) as Prisma.InputJsonValue,
            raw: (m.raw ?? undefined) as Prisma.InputJsonValue,
            fetchedAt: new Date(),
          },
        });
        changedMarkets.push(updated);
      }
    }

    const sortedNew = [...newMarkets].sort((a, b) => {
      const aT = a.closeTime?.getTime() ?? Infinity;
      const bT = b.closeTime?.getTime() ?? Infinity;
      return aT - bT;
    });
    const sortedChanged = [...changedMarkets].sort((a, b) => {
      const aT = a.closeTime?.getTime() ?? Infinity;
      const bT = b.closeTime?.getTime() ?? Infinity;
      return aT - bT;
    });

    return NextResponse.json({
      newMarkets: sortedNew.map((m) => toPublicMarket(m, event.title)),
      changedMarkets: sortedChanged.map((m) => toPublicMarket(m, event.title)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[markets/update] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
