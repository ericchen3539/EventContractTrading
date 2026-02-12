/**
 * GET /api/me/followed-events
 * Returns full event list for the current user's followed events.
 * Includes siteName and sectionName for display.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.userFollowedEvent.findMany({
      where: { userId: session.user.id },
      include: {
        eventCache: {
          include: {
            site: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const events = rows
      .map((r) => r.eventCache)
      .filter((ec): ec is NonNullable<typeof ec> => ec != null)
      .map((ec) => ({
        id: ec.id,
        siteId: ec.siteId,
        sectionId: ec.sectionId,
        externalId: ec.externalId,
        title: ec.title,
        description: ec.description ?? undefined,
        createdAt: ec.createdAt?.toISOString() ?? undefined,
        endDate: ec.endDate?.toISOString() ?? undefined,
        volume: ec.volume ?? undefined,
        liquidity: ec.liquidity ?? undefined,
        outcomes: ec.outcomes ?? undefined,
        fetchedAt: ec.fetchedAt.toISOString(),
        siteName: ec.site.name,
        sectionName: ec.section.name,
      }));

    return NextResponse.json(events);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[followed-events] GET error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
