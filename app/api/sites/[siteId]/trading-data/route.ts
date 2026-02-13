/**
 * GET /api/sites/[siteId]/trading-data
 * Fetch Kalshi portfolio data (balance, positions, fills, settlements) for a site.
 * Requires site to have apiKeyId and apiKeyPrivateKey configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import {
  fetchKalshiTradingData,
  getKalshiApiBase,
} from "@/lib/adapters/kalshi-portfolio";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

export async function GET(
  _request: NextRequest,
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
      { error: "Trading data is only supported for Kalshi sites" },
      { status: 400 }
    );
  }

  const apiKeyId = site.apiKeyId;
  const apiKeyPrivateKey = site.apiKeyPrivateKey;
  if (!apiKeyId || !apiKeyPrivateKey) {
    return NextResponse.json(
      { error: "Site has no API key configured. Add API Key ID and Private Key in site settings." },
      { status: 400 }
    );
  }

  try {
    const decryptedApiKeyId = decrypt(apiKeyId);
    const decryptedPrivateKey = decrypt(apiKeyPrivateKey);
    const apiBase = getKalshiApiBase(site.baseUrl);

    const data = await fetchKalshiTradingData(
      apiBase,
      decryptedApiKeyId,
      decryptedPrivateKey
    );

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const apiBase = getKalshiApiBase(site.baseUrl);
    console.error("[trading-data] GET error:", { err, apiBase, baseUrl: site.baseUrl });
    const hint =
      message.includes("fetch failed") || message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")
        ? " 请检查网络连接；若使用 Demo 账户，站点 baseUrl 需包含 demo（如 https://demo.kalshi.com）。"
        : "";
    return NextResponse.json(
      { error: `Failed to fetch trading data: ${message}${hint}` },
      { status: 502 }
    );
  }
}
