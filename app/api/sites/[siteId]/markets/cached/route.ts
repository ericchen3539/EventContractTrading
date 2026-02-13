/**
 * Cached markets API: GET — read Market from DB only (no adapter call).
 * Requires auth and site ownership.
 * Optional ?sectionIds=id1,id2 to filter sections.
 * Optional ?days=N to filter by closeTime <= today + N days; ?days=all for no date filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

function toPublicMarket(market: {
  id: string;
  eventCacheId: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  closeTime: Date | null;
  tradingCloseTime: Date | null;
  volume: number | null;
  liquidity: number | null;
  outcomes: unknown;
  fetchedAt: Date;
  eventCache?: { title: string } | null;
}) {
  return {
    id: market.id,
    eventCacheId: market.eventCacheId,
    siteId: market.siteId,
    sectionId: market.sectionId,
    externalId: market.externalId,
    title: market.title,
    eventTitle: market.eventCache?.title,
    closeTime: market.closeTime?.toISOString() ?? undefined,
    tradingCloseTime: market.tradingCloseTime?.toISOString() ?? undefined,
    volume: market.volume ?? undefined,
    liquidity: market.liquidity ?? undefined,
    outcomes: market.outcomes ?? undefined,
    fetchedAt: market.fetchedAt.toISOString(),
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
    console.error("[markets/cached] Unhandled error:", err);
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

  let sections = await prisma.section.findMany({
    where: { siteId, enabled: true },
    orderBy: { name: "asc" },
  });

  const { searchParams } = new URL(request.url);
  const sectionIdsParam = searchParams.get("sectionIds");
  if (sectionIdsParam) {
    const ids = sectionIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      sections = sections.filter((s) => ids.includes(s.id));
    }
  }

  const sectionIds = sections.map((s) => s.id);
  const where: {
    siteId: string;
    sectionId: { in: string[] };
    OR?: Array<
      | { tradingCloseTime: { lte: Date } }
      | { tradingCloseTime: null; closeTime: { lte: Date } }
    >;
  } = {
    siteId,
    sectionId: { in: sectionIds },
  };

  const daysParam = searchParams.get("days");
  if (daysParam && daysParam !== "all") {
    const days = parseInt(daysParam, 10);
    if (days > 0) {
      const cutoff = new Date(Date.now() + days * 86400000);
      where.OR = [
        { tradingCloseTime: { lte: cutoff } },
        { tradingCloseTime: null, closeTime: { lte: cutoff } },
      ];
    }
  }

  const markets = await prisma.market.findMany({
    where,
    include: { eventCache: { select: { title: true } } },
    orderBy: [{ tradingCloseTime: "asc" }, { closeTime: "asc" }],
  });

  return NextResponse.json(markets.map(toPublicMarket));
}
