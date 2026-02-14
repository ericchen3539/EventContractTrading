"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";

/**
 * Log out icon: arrow exiting box (SVG inline).
 */
function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/**
 * Dashboard navigation: links to Sites management and Events table.
 * User name trigger opens dropdown with 账户设置 and Log Out.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const displayName =
    session?.user?.name || session?.user?.email || "用户";

  const navLinks = [
    { href: "/guide", label: "用户指南" },
    { href: "/me/events", label: "用户事件" },
    { href: "/me/markets", label: "用户市场" },
    { href: "/me/trading", label: "交易账户" },
    { href: "/sites", label: "站点管理" },
    { href: "/events", label: "事件更新" },
  ];

  async function handleSignOut() {
    try {
      await signOut({ callbackUrl: "/login" });
      toast.success("已退出登录");
    } catch {
      toast.error("退出失败，请重试");
    }
  }

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
              const isActive =
                pathname === href || pathname.startsWith(href + "/");
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

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {status === "loading" ? (
              <span className="text-slate-400 dark:text-slate-500">…</span>
            ) : (
              displayName
            )}
          </button>

          {dropdownOpen && status === "authenticated" && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 min-w-[220px] rounded-lg border border-slate-200 bg-white py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              role="menu"
            >
              <div className="px-4 py-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {session?.user?.name || "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {session?.user?.email || "—"}
                </p>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700" />
              <div className="py-1">
                <Link
                  href="/me/account"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  账户设置
                </Link>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700" />
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  <LogOutIcon className="text-slate-500 dark:text-slate-400" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
