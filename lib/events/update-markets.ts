/**
 * Core logic for updating markets for an event.
 * Used by both single-event and batch update APIs.
 */
import { Prisma } from "@prisma/client";
import type { MarketInput } from "@/lib/adapters/types";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";

/** True if any semantic field (closeTime, volume, liquidity, outcomes) differs. Used for DB update. */
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

/** Round probability for stable comparison (avoids 0.97 vs 0.9700001). */
const OUTCOMES_PRECISION = 2;

function outcomesToComparable(outcomes: unknown): string {
  if (!outcomes || typeof outcomes !== "object") return "{}";
  const obj = outcomes as Record<string, number>;
  const sorted: Record<string, number> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    sorted[k] =
      typeof v === "number" && !Number.isNaN(v)
        ? Math.round(v * Math.pow(10, OUTCOMES_PRECISION)) / Math.pow(10, OUTCOMES_PRECISION)
        : 0;
  }
  return JSON.stringify(sorted);
}

/** True only when outcomes (价格|概率) differ semantically. Used to decide if market appears in 价格变更市场. */
function hasOutcomesChange(
  input: MarketInput,
  existing: { outcomes: unknown }
): boolean {
  return outcomesToComparable(input.outcomes) !== outcomesToComparable(existing.outcomes);
}

export type PublicMarket = {
  id: string;
  eventCacheId: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  eventTitle: string;
  closeTime?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  fetchedAt: string;
  /** Previous outcomes when market was updated due to price change; shown in 价格变更市场 */
  oldOutcomes?: Record<string, number>;
};

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
): PublicMarket {
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
    outcomes: (market.outcomes as Record<string, number>) ?? undefined,
    fetchedAt: market.fetchedAt.toISOString(),
  };
}

export type UpdateMarketsResult = {
  newMarkets: PublicMarket[];
  changedMarkets: PublicMarket[];
  adapterReturnedEmpty: boolean;
};

/**
 * Update markets for a single event. Caller must have verified the user owns the event's site.
 */
export async function updateMarketsForEvent(
  eventId: string
): Promise<UpdateMarketsResult> {
  const event = await prisma.eventCache.findUnique({
    where: { id: eventId },
    include: { site: true },
  });
  if (!event) throw new Error("Event not found");

  const adapter = getAdapter(event.site.adapterKey);
  if (!adapter) throw new Error(`Unknown adapter: ${event.site.adapterKey}`);

  const siteInput = {
    id: event.site.id,
    baseUrl: event.site.baseUrl,
    adapterKey: event.site.adapterKey,
  };

  const markets = await adapter.getMarketsForEvent(
    siteInput,
    event.externalId,
    event.createdAt
  );

  const newMarkets: Awaited<ReturnType<typeof prisma.market.create>>[] = [];
  /** Only markets with outcomes change; includes oldOutcomes for display */
  const priceChangedMarkets: Array<{
    market: Awaited<ReturnType<typeof prisma.market.update>>;
    oldOutcomes: Record<string, number>;
  }> = [];

  const existing = await prisma.market.findMany({
    where: { eventCacheId: eventId },
  });
  const existingMap = new Map(existing.map((m) => [m.externalId, m]));

  for (const m of markets) {
    const existingRecord = existingMap.get(m.externalId);

    if (!existingRecord) {
      const created = await prisma.market.create({
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
      const updated = await prisma.market.update({
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
      if (
        hasOutcomesChange(m, { outcomes: existingRecord.outcomes })
      ) {
        const oldOut = (existingRecord.outcomes as Record<string, number>) ?? {};
        priceChangedMarkets.push({ market: updated, oldOutcomes: oldOut });
      }
    }
  }

  const sortedNew = [...newMarkets].sort((a, b) => {
    const aT = a.closeTime?.getTime() ?? Infinity;
    const bT = b.closeTime?.getTime() ?? Infinity;
    return aT - bT;
  });
  const sortedChanged = [...priceChangedMarkets].sort((a, b) => {
    const aT = a.market.closeTime?.getTime() ?? Infinity;
    const bT = b.market.closeTime?.getTime() ?? Infinity;
    return aT - bT;
  });

  return {
    newMarkets: sortedNew.map((m) => toPublicMarket(m, event.title)),
    changedMarkets: sortedChanged.map(({ market, oldOutcomes }) => ({
      ...toPublicMarket(market, event.title),
      oldOutcomes,
    })),
    adapterReturnedEmpty: markets.length === 0,
  };
}
