/**
 * Edit site page: fetches site server-side, renders SiteForm in edit mode.
 * 404 if not found or not owned by user.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteForm } from "@/components/sites/SiteForm";
import { SectionSelector } from "@/components/sites/SectionSelector";

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const site = await prisma.site.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!site) notFound();

  const formValues = {
    id: site.id,
    name: site.name,
    baseUrl: site.baseUrl,
    adapterKey: site.adapterKey,
    hasCredentials: !!(
      site.loginUsername ||
      site.loginPassword ||
      site.apiKeyId ||
      site.apiKeyPrivateKey
    ),
    hasApiKey: !!(site.apiKeyId && site.apiKeyPrivateKey),
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        编辑站点
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        修改站点信息。凭证留空则不修改；填写新值将覆盖原有凭证。
      </p>
      <div className="mt-6">
        <SiteForm site={formValues} />
      </div>
      <div className="mt-8">
        <SectionSelector siteId={site.id} />
      </div>
      <Link
        href="/sites"
        className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400"
      >
        ← 返回站点列表
      </Link>
    </div>
  );
}
