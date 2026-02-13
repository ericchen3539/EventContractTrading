/**
 * GET /api/me/market-attention-map
 * Returns { [marketId]: attentionLevel } for the current user.
 * Used by market tables to show/edit attention levels for all markets.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.userFollowedMarket.findMany({
      where: { userId: session.user.id },
      select: { marketId: true, attentionLevel: true },
    });

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.marketId] = r.attentionLevel;
    }
    return NextResponse.json(map);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[market-attention-map] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
