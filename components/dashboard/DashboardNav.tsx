"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

/**
 * Dashboard navigation: links to Sites management and Events table.
 * Highlights active route; includes sign-out.
 */
export function DashboardNav() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/me", label: "我的" },
    { href: "/sites", label: "站点管理" },
    { href: "/events", label: "事件市场" },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <nav className="flex items-center gap-6">
          <Link
            href="/sites"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Event Contract
          </Link>
          <div className="flex gap-6">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
