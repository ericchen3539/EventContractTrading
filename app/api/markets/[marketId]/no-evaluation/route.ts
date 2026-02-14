/**
 * PATCH /api/markets/[marketId]/no-evaluation
 * Set or update user's No probability estimate and optional threshold for a market.
 * Requires user owns the site that owns the market.
 * noProbability: 0-1 (e.g. 0.9 for 90%); threshold: 0-1 (e.g. 0.1 for 10%), optional.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSafeErrorMessage } from "@/lib/api-utils";
import { DEFAULT_NO_EVALUATION_THRESHOLD } from "@/lib/constants";

function isValidProbability(v: unknown): v is number {
  return (
    typeof v === "number" &&
    !Number.isNaN(v) &&
    v >= 0 &&
    v <= 1
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { marketId } = await params;
    if (!marketId) {
      return NextResponse.json({ error: "Market ID required" }, { status: 400 });
    }

    let body: { noProbability?: unknown; threshold?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const noProbability = body?.noProbability;
    if (!isValidProbability(noProbability)) {
      return NextResponse.json(
        { error: "noProbability must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    const thresholdRaw = body?.threshold;
    const threshold =
      thresholdRaw === undefined || thresholdRaw === null
        ? DEFAULT_NO_EVALUATION_THRESHOLD
        : thresholdRaw;
    if (!isValidProbability(threshold)) {
      return NextResponse.json(
        { error: "threshold must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { site: true },
    });
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    if (market.site.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.marketNoEvaluation.upsert({
      where: {
        userId_marketId: {
          userId: session.user.id,
          marketId,
        },
      },
      create: {
        userId: session.user.id,
        marketId,
        noProbability,
        threshold,
      },
      update: { noProbability, threshold },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = getSafeErrorMessage(err);
    console.error("[market no-evaluation] PATCH error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
