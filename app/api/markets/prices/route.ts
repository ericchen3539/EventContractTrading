/**
 * GET /api/markets/prices?marketIds=id1,id2,id3
 * Fetch latest outcomes (prices) for given markets from the platform API.
 * Requires auth; only returns prices for markets in sites owned by the user.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { getAdapter } from "@/lib/adapters";

const MAX_MARKET_IDS = 50;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const marketIdsParam = searchParams.get("marketIds");
    const marketIds = marketIdsParam
      ? marketIdsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, MAX_MARKET_IDS)
      : [];

    if (marketIds.length === 0) {
      return NextResponse.json({ error: "marketIds required" }, { status: 400 });
    }

    const markets = await prisma.market.findMany({
      where: { id: { in: marketIds } },
      include: { site: true },
    });

    const result: Record<
      string,
      { outcomes?: Record<string, number>; fetchedAt: string }
    > = {};
    const now = new Date().toISOString();

    const fetchPromises = markets
      .filter((m) => m.site.userId === session.user.id)
      .map(async (m) => {
        const adapter = getAdapter(m.site.adapterKey);
        if (!adapter?.getMarketByTicker) {
          return { id: m.id, outcomes: undefined as Record<string, number> | undefined };
        }
        try {
          const siteInput = {
            id: m.site.id,
            baseUrl: m.site.baseUrl,
            adapterKey: m.site.adapterKey,
          };
          const data = await adapter.getMarketByTicker(siteInput, m.externalId);
          return {
            id: m.id,
            outcomes: data?.market?.outcomes,
          };
        } catch {
          return { id: m.id, outcomes: undefined as Record<string, number> | undefined };
        }
      });

    const fetched = await Promise.all(fetchPromises);
    for (const { id, outcomes } of fetched) {
      result[id] = { outcomes, fetchedAt: now };
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[markets/prices] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
