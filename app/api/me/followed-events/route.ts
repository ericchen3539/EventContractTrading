/**
 * GET /api/me/followed-events
 * Returns events for the current user's followed events.
 * Query params:
 *   - minAttention: show events with attentionLevel >= value (default 1)
 *   - unfollowed: when "true", show only attentionLevel === 0
 *   - mode: "top" = show only events with attentionLevel === max
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
      const maxRow = await prisma.userFollowedEvent.aggregate({
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

    const rows = await prisma.userFollowedEvent.findMany({
      where: whereClause,
      include: {
        eventCache: {
          include: {
            site: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    const events = rows
      .filter((r) => {
        if (r.eventCache == null) return false;
        const s = r.eventCache.status;
        return s == null || isActiveStatus(s);
      })
      .map((r) => {
        const ec = r.eventCache!;
        return {
        id: ec.id,
        siteId: ec.siteId,
        sectionId: ec.sectionId,
        externalId: ec.externalId,
        title: ec.title,
        description: ec.description ?? undefined,
        createdAt: ec.createdAt?.toISOString() ?? undefined,
        endDate: ec.endDate?.toISOString() ?? undefined,
        volume: ec.volume ?? undefined,
        liquidity: ec.liquidity ?? undefined,
        outcomes: ec.outcomes ?? undefined,
        fetchedAt: ec.fetchedAt.toISOString(),
        siteName: ec.site.name,
        sectionName: ec.section.name,
        attentionLevel: r.attentionLevel,
      };
      })
      .sort((a, b) => {
        const aT = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
        const bT = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
        return aT - bT;
      });

    return NextResponse.json(events);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[followed-events] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
