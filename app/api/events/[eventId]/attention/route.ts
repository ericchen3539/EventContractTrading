/**
 * PUT /api/events/[eventId]/attention
 * Set or update attention level for an event.
 * Requires user owns the site that owns the event.
 * attentionLevel: non-negative integer (0, 1, 2, ...).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    await prisma.userFollowedEvent.upsert({
      where: {
        userId_eventCacheId: {
          userId: session.user.id,
          eventCacheId: eventId,
        },
      },
      create: {
        userId: session.user.id,
        eventCacheId: eventId,
        attentionLevel,
      },
      update: { attentionLevel },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[attention] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
