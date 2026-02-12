/**
 * My page: displays user's followed events and browse-to-follow flow.
 * Fetches user's sites server-side; events loaded client-side via API.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MePageContent } from "@/components/me/MePageContent";
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

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (sites.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          我的
        </h1>
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">暂无站点</p>
          <Link
            href="/sites/new"
            className="mt-4 inline-block rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            添加站点
          </Link>
        </div>
      </div>
    );
  }

  return <MePageContent sites={sites.map(toPublicSite)} />;
}
