/**
 * PUT /api/events/markets/update/batch
 * Update markets for multiple events. Runs with server-side concurrency control.
 * Returns aggregated newCount, changedCount, and full newMarkets/changedMarkets for frontend.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateMarketsForEvent } from "@/lib/events/update-markets";
import { MAX_SELECTED_EVENTS, DEFAULT_NO_EVALUATION_THRESHOLD } from "@/lib/constants";
import { getSafeErrorMessage } from "@/lib/api-utils";

const BATCH_CONCURRENCY = 3;

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { eventIds?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const eventIds = Array.isArray(body?.eventIds)
      ? body.eventIds.filter((id): id is string => typeof id === "string")
      : [];
    if (eventIds.length === 0) {
      return NextResponse.json(
        { error: "eventIds array required and must not be empty" },
        { status: 400 }
      );
    }
    if (eventIds.length > MAX_SELECTED_EVENTS) {
      return NextResponse.json(
        { error: `At most ${MAX_SELECTED_EVENTS} eventIds per request` },
        { status: 400 }
      );
    }

    const events = await prisma.eventCache.findMany({
      where: { id: { in: eventIds } },
      include: { site: true },
    });
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const authorizedIds = events
      .filter((e) => e.site.userId === session.user!.id)
      .map((e) => e.id);

    const allNew: Awaited<ReturnType<typeof updateMarketsForEvent>>["newMarkets"] = [];
    const allChanged: Awaited<ReturnType<typeof updateMarketsForEvent>>["changedMarkets"] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < authorizedIds.length; i += BATCH_CONCURRENCY) {
      const chunk = authorizedIds.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((eventId) =>
          updateMarketsForEvent(eventId, session.user!.id)
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          successCount += 1;
          allNew.push(...r.value.newMarkets);
          allChanged.push(...r.value.changedMarkets);
        } else {
          failCount += 1;
          console.error("[markets/update/batch] Event failed:", r.reason);
        }
      }
    }

    failCount += eventIds.length - authorizedIds.length;

    const allMarketIds = [
      ...allNew.map((m) => m.id),
      ...allChanged.map((m) => m.id),
    ];
    const evaluations = await prisma.marketNoEvaluation.findMany({
      where: { userId: session.user!.id, marketId: { in: allMarketIds } },
    });
    const evalMap = new Map(
      evaluations.map((e) => [
        e.marketId,
        { noEvaluation: e.noProbability, threshold: e.threshold },
      ])
    );
    const attachEval = (m: { id: string }) => {
      const ev = evalMap.get(m.id);
      return {
        ...m,
        noEvaluation: ev?.noEvaluation,
        threshold: ev?.threshold ?? DEFAULT_NO_EVALUATION_THRESHOLD,
      };
    };

    return NextResponse.json({
      newCount: allNew.length,
      changedCount: allChanged.length,
      successCount,
      failedCount: failCount,
      newMarkets: allNew.map(attachEval),
      changedMarkets: allChanged.map(attachEval),
    });
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[markets/update/batch] PUT error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
