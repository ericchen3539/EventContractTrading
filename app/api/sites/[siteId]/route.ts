/**
 * Sites API: GET (single site), PUT (update), DELETE (delete).
 * All operations require authentication and ownership verification.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { toPublicSite } from "@/lib/api-transform";

const ALLOWED_ADAPTER_KEYS = ["kalshi"] as const;

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

  return NextResponse.json(toPublicSite(site));
}

export async function PUT(
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

  let body: {
    name?: string;
    baseUrl?: string;
    adapterKey?: string;
    loginUsername?: string;
    loginPassword?: string;
    apiKeyId?: string;
    apiKeyPrivateKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: {
    name?: string;
    baseUrl?: string;
    adapterKey?: string;
    loginUsername?: string | null;
    loginPassword?: string | null;
    apiKeyId?: string | null;
    apiKeyPrivateKey?: string | null;
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    updates.name = name;
  }
  if (typeof body.baseUrl === "string") {
    const baseUrl = body.baseUrl.trim();
    if (!baseUrl) {
      return NextResponse.json({ error: "baseUrl cannot be empty" }, { status: 400 });
    }
    try {
      const u = new URL(baseUrl);
      if (!["http:", "https:"].includes(u.protocol)) {
        return NextResponse.json(
          { error: "baseUrl must use http or https protocol" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
    }
    updates.baseUrl = baseUrl;
  }
  if (typeof body.adapterKey === "string") {
    if (!ALLOWED_ADAPTER_KEYS.includes(body.adapterKey as (typeof ALLOWED_ADAPTER_KEYS)[number])) {
      return NextResponse.json(
        { error: `adapterKey must be one of: ${ALLOWED_ADAPTER_KEYS.join(", ")}` },
        { status: 400 }
      );
    }
    updates.adapterKey = body.adapterKey;
  }
  try {
    if (body.loginUsername !== undefined) {
      updates.loginUsername =
        typeof body.loginUsername === "string" && body.loginUsername.trim()
          ? encrypt(body.loginUsername.trim())
          : null;
    }
    if (body.loginPassword !== undefined) {
      updates.loginPassword =
        typeof body.loginPassword === "string" && body.loginPassword
          ? encrypt(body.loginPassword)
          : null;
    }
    if (body.apiKeyId !== undefined) {
      updates.apiKeyId =
        typeof body.apiKeyId === "string" && body.apiKeyId.trim()
          ? encrypt(body.apiKeyId.trim())
          : null;
    }
    if (body.apiKeyPrivateKey !== undefined) {
      updates.apiKeyPrivateKey =
        typeof body.apiKeyPrivateKey === "string" && body.apiKeyPrivateKey.trim()
          ? encrypt(body.apiKeyPrivateKey.trim())
          : null;
    }

    const updated = await prisma.site.update({
      where: { id: siteId },
      data: updates,
    });
    return NextResponse.json(toPublicSite(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sites] PUT error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  await prisma.site.delete({ where: { id: siteId } });
  return NextResponse.json({ success: true });
}
