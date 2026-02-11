/**
 * Sites API: GET (list user's sites), POST (create site).
 * All operations require authentication; credentials are encrypted before storage.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

const ALLOWED_ADAPTER_KEYS = ["kalshi"] as const;

function toPublicSite(site: {
  id: string;
  userId: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  loginUsername: string | null;
  loginPassword: string | null;
  createdAt: Date;
}) {
  return {
    id: site.id,
    userId: site.userId,
    name: site.name,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
    hasCredentials: !!(site.loginUsername || site.loginPassword),
    createdAt: site.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sites.map(toPublicSite));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    baseUrl?: string;
    adapterKey?: string;
    loginUsername?: string;
    loginPassword?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
  const adapterKey = typeof body.adapterKey === "string" ? body.adapterKey : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!baseUrl) {
    return NextResponse.json({ error: "baseUrl is required" }, { status: 400 });
  }
  if (!ALLOWED_ADAPTER_KEYS.includes(adapterKey as (typeof ALLOWED_ADAPTER_KEYS)[number])) {
    return NextResponse.json(
      { error: `adapterKey must be one of: ${ALLOWED_ADAPTER_KEYS.join(", ")}` },
      { status: 400 }
    );
  }

  const loginUsername =
    typeof body.loginUsername === "string" ? body.loginUsername.trim() || null : null;
  const loginPassword =
    typeof body.loginPassword === "string" ? body.loginPassword || null : null;

  const site = await prisma.site.create({
    data: {
      userId: session.user.id,
      name,
      baseUrl,
      adapterKey,
      loginUsername: loginUsername ? encrypt(loginUsername) : null,
      loginPassword: loginPassword ? encrypt(loginPassword) : null,
    },
  });

  return NextResponse.json(toPublicSite(site), { status: 201 });
}
