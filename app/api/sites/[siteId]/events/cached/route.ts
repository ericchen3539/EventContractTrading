/**
 * Cached events API: GET — read EventCache from DB only (no adapter call).
 * Requires auth and site ownership.
 * Optional ?sectionIds=id1,id2 to filter sections.
 * Optional ?days=N to filter by createdAt (最近交易截止时间) <= today + N days; ?days=all for no date filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

function toPublicEvent(event: {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description: string | null;
  createdAt: Date | null;
  endDate: Date | null;
  volume: number | null;
  liquidity: number | null;
  outcomes: unknown;
  fetchedAt: Date;
}) {
  return {
    id: event.id,
    siteId: event.siteId,
    sectionId: event.sectionId,
    externalId: event.externalId,
    title: event.title,
    description: event.description ?? undefined,
    createdAt: event.createdAt?.toISOString() ?? undefined,
    endDate: event.endDate?.toISOString() ?? undefined,
    volume: event.volume ?? undefined,
    liquidity: event.liquidity ?? undefined,
    outcomes: event.outcomes ?? undefined,
    fetchedAt: event.fetchedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ siteId: string }> }
) {
  try {
    return await handleGet(request, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[events/cached] Unhandled error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const site = await getSiteForUser(siteId, session.user.id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  let sections = await prisma.section.findMany({
    where: { siteId, enabled: true },
    orderBy: { name: "asc" },
  });

  const { searchParams } = new URL(request.url);
  const sectionIdsParam = searchParams.get("sectionIds");
  if (sectionIdsParam) {
    const ids = sectionIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      sections = sections.filter((s) => ids.includes(s.id));
    }
  }

  const sectionIds = sections.map((s) => s.id);
  const daysParam = searchParams.get("days");
  const where: Prisma.EventCacheWhereInput = {
    siteId,
    sectionId: { in: sectionIds },
    OR: [
      { status: { in: ["open", "active"] } },
      { status: null },
    ],
  };
  if (daysParam && daysParam !== "all") {
    const days = parseInt(daysParam, 10);
    if (days > 0) {
      const cutoff = new Date(Date.now() + days * 86400000);
      where.createdAt = { lte: cutoff };
    }
  }

  const events = await prisma.eventCache.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(events.map(toPublicEvent));
}
