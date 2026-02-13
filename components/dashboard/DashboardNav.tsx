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
    { href: "/me/events", label: "用户事件" },
    { href: "/me/markets", label: "用户市场" },
    { href: "/sites", label: "站点管理" },
    { href: "/events", label: "事件更新" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <nav className="flex items-center gap-6">
          <Link
            href="/sites"
            className="text-lg font-semibold text-blue-600 dark:text-blue-400"
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
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
