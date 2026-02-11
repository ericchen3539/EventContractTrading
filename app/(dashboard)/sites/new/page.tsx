/**
 * New site page: renders SiteForm in create mode.
 */
import Link from "next/link";
import { SiteForm } from "@/components/sites/SiteForm";

export default function NewSitePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        添加站点
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        添加外部交易平台（如 Kalshi）。读板块与事件无需登录信息；可选填凭证供后续扩展。
      </p>
      <div className="mt-6">
        <SiteForm />
      </div>
      <Link
        href="/sites"
        className="mt-6 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← 返回站点列表
      </Link>
    </div>
  );
}
