/**
 * GET /api/me/followed-markets
 * Returns markets for the current user's followed markets.
 * Query params:
 *   - minAttention: show markets with attentionLevel >= value (default 1)
 *   - unfollowed: when "true", show only attentionLevel === 0
 *   - mode: "top" = show only markets with attentionLevel === max
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isActiveStatus } from "@/lib/constants";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const minAttentionParam = searchParams.get("minAttention");
    const showUnfollowed = searchParams.get("unfollowed") === "true";
    const mode = searchParams.get("mode"); // "top" = 我最关注

    type WhereClause = {
      userId: string;
      attentionLevel?: number | { gte: number };
    };
    let whereClause: WhereClause = {
      userId: session.user.id,
    };

    if (showUnfollowed) {
      whereClause.attentionLevel = 0;
    } else if (mode === "top") {
      const maxRow = await prisma.userFollowedMarket.aggregate({
        where: { userId: session.user.id },
        _max: { attentionLevel: true },
      });
      const maxLevel = maxRow._max.attentionLevel ?? 0;
      whereClause.attentionLevel = maxLevel;
    } else {
      const minAttention =
        minAttentionParam != null && minAttentionParam !== ""
          ? parseInt(minAttentionParam, 10)
          : 1;
      if (!Number.isNaN(minAttention) && minAttention >= 0) {
        whereClause.attentionLevel = { gte: minAttention };
      }
    }

    const rows = await prisma.userFollowedMarket.findMany({
      where: whereClause,
      include: {
        market: {
          include: {
            site: { select: { name: true } },
            section: { select: { name: true } },
            eventCache: { select: { title: true } },
          },
        },
      },
    });

    const markets = rows
      .filter((r) => {
        if (r.market == null) return false;
        const s = r.market.status;
        return s == null || isActiveStatus(s);
      })
      .map((r) => {
        const mc = r.market!;
        return {
          id: mc.id,
          eventCacheId: mc.eventCacheId,
          siteId: mc.siteId,
          sectionId: mc.sectionId,
          externalId: mc.externalId,
          title: mc.title,
          eventTitle: mc.eventCache?.title,
          closeTime: mc.closeTime?.toISOString() ?? undefined,
          tradingCloseTime: mc.tradingCloseTime?.toISOString() ?? undefined,
          volume: mc.volume ?? undefined,
          liquidity: mc.liquidity ?? undefined,
          outcomes: mc.outcomes ?? undefined,
          fetchedAt: mc.fetchedAt.toISOString(),
          siteName: mc.site.name,
          sectionName: mc.section.name,
          attentionLevel: r.attentionLevel,
        };
      })
      .sort((a, b) => {
        const aT = (a.tradingCloseTime ?? a.closeTime)
          ? new Date(a.tradingCloseTime ?? a.closeTime!).getTime()
          : Infinity;
        const bT = (b.tradingCloseTime ?? b.closeTime)
          ? new Date(b.tradingCloseTime ?? b.closeTime!).getTime()
          : Infinity;
        return aT - bT;
      });

    return NextResponse.json(markets);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[followed-markets] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
