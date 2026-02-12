/**
 * Sections API: GET (list sections for a site), POST (sync sections from adapter).
 * All operations require authentication and site ownership verification.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/adapters";

async function getSiteForUser(siteId: string, userId: string) {
  return prisma.site.findFirst({
    where: { id: siteId, userId },
  });
}

function toPublicSection(section: {
  id: string;
  siteId: string;
  externalId: string;
  name: string;
  urlOrSlug: string | null;
  enabled: boolean;
}) {
  return {
    id: section.id,
    siteId: section.siteId,
    externalId: section.externalId,
    name: section.name,
    urlOrSlug: section.urlOrSlug ?? undefined,
    enabled: section.enabled,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  const site = await getSiteForUser(siteId, session.user.id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const sections = await prisma.section.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sections.map(toPublicSection));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { siteId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const site = await getSiteForUser(siteId, session.user.id);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const adapter = getAdapter(site.adapterKey);
    if (!adapter) {
      return NextResponse.json(
        { error: `Unknown adapter: ${site.adapterKey}` },
        { status: 400 }
      );
    }

    const siteInput = {
      id: site.id,
      baseUrl: site.baseUrl,
      adapterKey: site.adapterKey,
    };

    let adapterSections;
    try {
      adapterSections = await adapter.getSections(siteInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Adapter fetch failed";
      console.error("[sections] Adapter fetch failed:", { siteId, adapterKey: site.adapterKey, error: err });
      return NextResponse.json(
        { error: `Failed to fetch sections: ${msg}` },
        { status: 502 }
      );
    }

    const externalIds = new Set(adapterSections.map((s) => s.externalId));

    if (adapterSections.length > 0) {
      const values = adapterSections.map(
        (sec) =>
          Prisma.sql`(gen_random_uuid()::text, ${siteId}, ${sec.externalId}, ${sec.name}, ${sec.urlOrSlug ?? null}, true)`
      );
      await prisma.$executeRaw`
        INSERT INTO "Section" ("id", "siteId", "externalId", "name", "urlOrSlug", "enabled")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("siteId", "externalId")
        DO UPDATE SET "name" = EXCLUDED."name", "urlOrSlug" = EXCLUDED."urlOrSlug"
      `;
    }

    await prisma.section.deleteMany({
      where: {
        siteId,
        ...(externalIds.size > 0 ? { externalId: { notIn: Array.from(externalIds) } } : {}),
      },
    });

    const sections = await prisma.section.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(sections.map(toPublicSection), { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[sections] POST unhandled error:", err);
    return NextResponse.json(
      { error: `Sync failed: ${msg}` },
      { status: 500 }
    );
  }
}
