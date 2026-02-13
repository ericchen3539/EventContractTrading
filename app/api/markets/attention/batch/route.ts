/**
 * PUT /api/markets/attention/batch
 * Set or update attention level for multiple markets.
 * Requires user owns the site that owns each market.
 * Max 50 updates per request.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { MAX_SELECTED_MARKETS } from "@/lib/constants";

function isValidAttentionLevel(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    !Number.isNaN(v) &&
    v >= 0
  );
}

function isValidUpdate(
  item: unknown
): item is { marketId: string; attentionLevel: number } {
  return (
    item != null &&
    typeof item === "object" &&
    "marketId" in item &&
    typeof (item as { marketId: unknown }).marketId === "string" &&
    "attentionLevel" in item &&
    isValidAttentionLevel((item as { attentionLevel: unknown }).attentionLevel)
  );
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { updates?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const rawUpdates = body?.updates;
    if (!Array.isArray(rawUpdates)) {
      return NextResponse.json(
        { error: "updates must be an array" },
        { status: 400 }
      );
    }

    if (rawUpdates.length > MAX_SELECTED_MARKETS) {
      return NextResponse.json(
        { error: `At most ${MAX_SELECTED_MARKETS} updates per request` },
        { status: 400 }
      );
    }

    const updates = rawUpdates.filter(
      (u): u is { marketId: string; attentionLevel: number } => isValidUpdate(u)
    );

    if (updates.length !== rawUpdates.length) {
      return NextResponse.json(
        {
          error:
            "Each update must have marketId (string) and attentionLevel (non-negative integer)",
        },
        { status: 400 }
      );
    }

    const marketIds = updates.map((u) => u.marketId);
    const markets = await prisma.market.findMany({
      where: { id: { in: marketIds } },
      include: { site: true },
    });

    const marketMap = new Map(markets.map((m) => [m.id, m]));
    const invalidIds = marketIds.filter((id) => !marketMap.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Market not found", ids: invalidIds },
        { status: 404 }
      );
    }

    const forbiddenIds = markets
      .filter((m) => m.site.userId !== session.user!.id)
      .map((m) => m.id);
    if (forbiddenIds.length > 0) {
      return NextResponse.json(
        { error: "Forbidden", ids: forbiddenIds },
        { status: 403 }
      );
    }

    await prisma.$transaction(
      updates.map(({ marketId, attentionLevel }) =>
        prisma.userFollowedMarket.upsert({
          where: {
            userId_marketId: {
              userId: session.user!.id,
              marketId,
            },
          },
          create: {
            userId: session.user!.id,
            marketId,
            attentionLevel,
          },
          update: { attentionLevel },
        })
      )
    );

    return NextResponse.json({ ok: true, count: updates.length });
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[market attention/batch] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
