/**
 * Sites list page: fetches user's sites server-side, renders SiteList.
 * Create/edit/delete via client components.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SiteList } from "@/components/sites/SiteList";
import { toPublicSite } from "@/lib/api-transform";
import Link from "next/link";

export default async function SitesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          站点管理
        </h1>
        <Link
          href="/sites/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          添加站点
        </Link>
      </div>
      <SiteList sites={sites.map(toPublicSite)} />
    </div>
  );
}
