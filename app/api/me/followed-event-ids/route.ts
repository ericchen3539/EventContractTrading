/**
 * GET /api/me/followed-event-ids
 * Returns array of eventCacheIds the current user has followed.
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

    const rows = await prisma.userFollowedEvent.findMany({
      where: { userId: session.user.id },
      select: { eventCacheId: true },
    });

    const ids = rows.map((r) => r.eventCacheId);
    return NextResponse.json(ids);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[followed-event-ids] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
