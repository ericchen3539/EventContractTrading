/**
 * My page: site/section selectors and events.
 * Fetches user's sites server-side; events loaded client-side via API.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MePageContent } from "@/components/me/MePageContent";

function toPublicSite(site: {
  id: string;
  name: string;
  baseUrl: string;
  adapterKey: string;
  loginUsername: string | null;
  loginPassword: string | null;
  createdAt: Date;
}) {
  return {
    id: site.id,
    name: site.name,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
    hasCredentials: !!(site.loginUsername || site.loginPassword),
    createdAt: site.createdAt.toISOString(),
  };
}

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return <MePageContent sites={sites.map(toPublicSite)} />;
}
