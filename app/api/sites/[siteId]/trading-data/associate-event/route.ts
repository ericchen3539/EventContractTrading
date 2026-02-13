/**
 * POST /api/sites/[siteId]/trading-data/associate-event
 * Associate an event position with EventCache: fetch from Kalshi, compare, upsert, return title.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";
import { hasSemanticChanges } from "@/lib/events/event-compare";
import { getSafeErrorMessage } from "@/lib/api-utils";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

export async function POST(
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

  if (site.adapterKey !== "kalshi") {
    return NextResponse.json(
      { error: "Event association is only supported for Kalshi sites" },
      { status: 400 }
    );
  }

  let body: { eventTicker?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventTicker = typeof body.eventTicker === "string" ? body.eventTicker.trim() : "";
  if (!eventTicker) {
    return NextResponse.json({ error: "eventTicker is required" }, { status: 400 });
  }

  const adapter = getAdapter(site.adapterKey);
  if (!adapter?.getEventByTicker) {
    return NextResponse.json(
      { error: "Adapter does not support event association" },
      { status: 400 }
    );
  }

  const siteInput = {
    id: site.id,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
  };

  let ev;
  try {
    ev = await adapter.getEventByTicker(siteInput, eventTicker);
  } catch (err) {
    const msg = getSafeErrorMessage(err, "Failed to fetch event");
    console.error("[associate-event] Adapter fetch error:", { siteId, eventTicker, err });
    return NextResponse.json(
      { error: `拉取事件失败：${msg}` },
      { status: 502 }
    );
  }

  if (!ev) {
    return NextResponse.json(
      { error: "事件不存在或无法获取" },
      { status: 404 }
    );
  }

  const category = ev.sectionExternalId;

  let section = await prisma.section.findFirst({
    where: { siteId, externalId: category },
  });

  if (!section) {
    const adapterSections = await adapter.getSections(siteInput);
    const sectionConfig = adapterSections.find((s) => s.externalId === category);
    const name = sectionConfig?.name ?? category;

    section = await prisma.section.upsert({
      where: {
        siteId_externalId: { siteId, externalId: category },
      },
      create: {
        siteId,
        externalId: category,
        name,
        enabled: true,
      },
      update: { name },
    });
  }

  const existing = await prisma.eventCache.findMany({
    where: { siteId, externalId: eventTicker },
  });

  if (existing.length === 0) {
    await prisma.eventCache.create({
      data: {
        siteId,
        sectionId: section.id,
        externalId: ev.externalId,
        title: ev.title,
        description: ev.description ?? null,
        status: ev.status ?? null,
        createdAt: ev.createdAt ?? null,
        endDate: ev.endDate ?? null,
        volume: ev.volume ?? null,
        liquidity: ev.liquidity ?? null,
        outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
        raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
      },
    });
  } else if (hasSemanticChanges(ev, existing[0])) {
    await prisma.eventCache.updateMany({
      where: { siteId, externalId: eventTicker },
      data: {
        title: ev.title,
        description: ev.description ?? null,
        status: ev.status ?? null,
        createdAt: ev.createdAt ?? null,
        endDate: ev.endDate ?? null,
        volume: ev.volume ?? null,
        liquidity: ev.liquidity ?? null,
        outcomes: (ev.outcomes ?? undefined) as Prisma.InputJsonValue,
        raw: (ev.raw ?? undefined) as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ title: ev.title });
}
