/**
 * PUT /api/markets/[marketId]/attention
 * Set or update attention level for a market.
 * Requires user owns the site that owns the market.
 * attentionLevel: non-negative integer (0, 1, 2, ...).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";

function isValidAttentionLevel(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    !Number.isNaN(v) &&
    v >= 0
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { marketId } = await params;
    if (!marketId) {
      return NextResponse.json({ error: "Market ID required" }, { status: 400 });
    }

    let body: { attentionLevel?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const attentionLevel = body?.attentionLevel;
    if (!isValidAttentionLevel(attentionLevel)) {
      return NextResponse.json(
        { error: "attentionLevel must be a non-negative integer" },
        { status: 400 }
      );
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { site: true },
    });
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    if (market.site.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.userFollowedMarket.upsert({
      where: {
        userId_marketId: {
          userId: session.user.id,
          marketId,
        },
      },
      create: {
        userId: session.user.id,
        marketId,
        attentionLevel,
      },
      update: { attentionLevel },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[market attention] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
