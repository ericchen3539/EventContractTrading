/**
 * Events table page: site/section filters, TanStack Table display.
 * Fetches user's sites server-side; events loaded client-side via API.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EventsPageContent } from "@/components/events-table/EventsPageContent";
import Link from "next/link";

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

export default async function EventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (sites.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          事件市场
        </h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-400">暂无站点</p>
          <Link
            href="/sites/new"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            添加站点
          </Link>
        </div>
      </div>
    );
  }

  return <EventsPageContent sites={sites.map(toPublicSite)} />;
}
