/**
 * User trading account page: displays Kalshi portfolio (balance, positions, fills, settlements).
 * Requires site to have API Key configured.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toPublicSite } from "@/lib/api-transform";
import { TradingAccountPageContent } from "@/components/me/TradingAccountPageContent";

export default async function TradingAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <TradingAccountPageContent sites={sites.map(toPublicSite)} />
    </div>
  );
}
