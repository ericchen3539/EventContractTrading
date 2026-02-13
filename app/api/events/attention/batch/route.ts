/**
 * PUT /api/events/attention/batch
 * Set or update attention level for multiple events.
 * Requires user owns the site that owns each event.
 * Max 50 updates per request.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { MAX_SELECTED_EVENTS } from "@/lib/constants";

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
): item is { eventId: string; attentionLevel: number } {
  return (
    item != null &&
    typeof item === "object" &&
    "eventId" in item &&
    typeof (item as { eventId: unknown }).eventId === "string" &&
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

    if (rawUpdates.length > MAX_SELECTED_EVENTS) {
      return NextResponse.json(
        { error: `At most ${MAX_SELECTED_EVENTS} updates per request` },
        { status: 400 }
      );
    }

    const updates = rawUpdates.filter(
      (u): u is { eventId: string; attentionLevel: number } => isValidUpdate(u)
    );

    if (updates.length !== rawUpdates.length) {
      return NextResponse.json(
        {
          error:
            "Each update must have eventId (string) and attentionLevel (non-negative integer)",
        },
        { status: 400 }
      );
    }

    const eventIds = updates.map((u) => u.eventId);
    const events = await prisma.eventCache.findMany({
      where: { id: { in: eventIds } },
      include: { site: true },
    });

    const eventMap = new Map(events.map((e) => [e.id, e]));
    const invalidIds = eventIds.filter((id) => !eventMap.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Event not found", ids: invalidIds },
        { status: 404 }
      );
    }

    const forbiddenIds = events
      .filter((e) => e.site.userId !== session.user!.id)
      .map((e) => e.id);
    if (forbiddenIds.length > 0) {
      return NextResponse.json(
        { error: "Forbidden", ids: forbiddenIds },
        { status: 403 }
      );
    }

    await prisma.$transaction(
      updates.map(({ eventId, attentionLevel }) =>
        prisma.userFollowedEvent.upsert({
          where: {
            userId_eventCacheId: {
              userId: session.user!.id,
              eventCacheId: eventId,
            },
          },
          create: {
            userId: session.user!.id,
            eventCacheId: eventId,
            attentionLevel,
          },
          update: { attentionLevel },
        })
      )
    );

    return NextResponse.json({ ok: true, count: updates.length });
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[attention/batch] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
