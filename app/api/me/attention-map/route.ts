/**
 * GET /api/me/attention-map
 * Returns { [eventCacheId]: attentionLevel } for the current user.
 * Used by event market to show/edit attention levels for all events.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.userFollowedEvent.findMany({
      where: { userId: session.user.id },
      select: { eventCacheId: true, attentionLevel: true },
    });

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.eventCacheId] = r.attentionLevel;
    }
    return NextResponse.json(map);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[attention-map] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
