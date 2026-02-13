/**
 * Cached events API: GET — read EventCache from DB only (no adapter call).
 * Requires auth and site ownership.
 * Optional ?sectionIds=id1,id2 to filter sections.
 * Optional ?days=N to filter by nextTradingCloseTime (最近交易截止时间) <= today + N days; ?days=all for no date filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPublicEvent } from "@/lib/api-transform";
import { getSafeErrorMessage } from "@/lib/api-utils";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ siteId: string }> }
) {
  try {
    return await handleGet(request, ctx);
  } catch (err) {
    const msg = getSafeErrorMessage(err);
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
    const parsed = parseInt(daysParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const days = Math.min(365, parsed);
      const cutoff = new Date(Date.now() + days * 86400000);
      where.nextTradingCloseTime = { lte: cutoff };
    }
  }

  const events = await prisma.eventCache.findMany({
    where,
    orderBy: { nextTradingCloseTime: "asc" },
  });

  return NextResponse.json(events.map(toPublicEvent));
}
