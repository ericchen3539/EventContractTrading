/**
 * PUT /api/events/[eventId]/markets/update
 * Fetch markets for the event, upsert to Market, return newMarkets and changedMarkets.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateMarketsForEvent } from "@/lib/events/update-markets";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const event = await prisma.eventCache.findUnique({
      where: { id: eventId },
      include: { site: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.site.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await updateMarketsForEvent(eventId, session.user.id);

    return NextResponse.json({
      newMarkets: result.newMarkets,
      changedMarkets: result.changedMarkets,
      adapterReturnedEmpty: result.adapterReturnedEmpty,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[markets/update] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
