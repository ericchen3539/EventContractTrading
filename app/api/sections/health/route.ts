/**
 * Sections health check: verifies adapter can reach external API.
 * GET /api/sections/health?adapterKey=kalshi
 * Requires auth. Returns { ok: true } or { ok: false, error: "..." }.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const KALSHI_SERIES_URL = "https://api.elections.kalshi.com/trade-api/v2/series?category=Politics";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const adapterKey = searchParams.get("adapterKey") ?? "kalshi";

  if (adapterKey !== "kalshi") {
    return NextResponse.json(
      { ok: false, error: `Unsupported adapterKey: ${adapterKey}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(KALSHI_SERIES_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Kalshi API returned ${res.status} ${res.statusText}` },
        { status: 200 }
      );
    }

    const data = (await res.json()) as { series?: unknown[] };
    if (!data.series || !Array.isArray(data.series)) {
      return NextResponse.json(
        { ok: false, error: "Kalshi API response missing or invalid series array" },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, seriesCount: data.series.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Failed to reach Kalshi API: ${msg}` },
      { status: 200 }
    );
  }
}
