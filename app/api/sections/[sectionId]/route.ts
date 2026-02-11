/**
 * Section PATCH: update enabled state.
 * Requires auth and site ownership.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sectionId } = await params;

  let body: { enabled?: boolean };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  if (enabled === undefined) {
    return NextResponse.json(
      { error: "enabled (boolean) is required" },
      { status: 400 }
    );
  }

  const section = await prisma.section.findFirst({
    where: { id: sectionId },
    include: { site: true },
  });

  if (!section || section.site.userId !== session.user.id) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: { enabled },
  });

  return NextResponse.json({
    id: updated.id,
    siteId: updated.siteId,
    externalId: updated.externalId,
    name: updated.name,
    urlOrSlug: updated.urlOrSlug ?? undefined,
    enabled: updated.enabled,
  });
}
