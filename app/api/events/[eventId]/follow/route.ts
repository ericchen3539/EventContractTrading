/**
 * Follow/unfollow event API.
 * POST: follow event (requires user owns the site that owns the event).
 * DELETE: unfollow event.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function handleFollow(eventId: string, userId: string) {
  const event = await prisma.eventCache.findUnique({
    where: { id: eventId },
    include: { site: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.site.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.userFollowedEvent.upsert({
    where: {
      userId_eventCacheId: { userId, eventCacheId: eventId },
    },
    create: { userId, eventCacheId: eventId },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

async function handleUnfollow(eventId: string, userId: string) {
  await prisma.userFollowedEvent.deleteMany({
    where: { userId, eventCacheId: eventId },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(
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
    return handleFollow(eventId, session.user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[follow] POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
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
    return handleUnfollow(eventId, session.user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[follow] DELETE error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
