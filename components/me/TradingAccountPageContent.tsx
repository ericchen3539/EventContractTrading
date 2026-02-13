"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate, formatCents } from "@/lib/format";
import type {
  KalshiBalance,
  KalshiMarketPosition,
  KalshiEventPosition,
  KalshiFill,
  KalshiSettlement,
} from "@/lib/adapters/kalshi-portfolio";

const PAGE_SIZE = 10;

interface SiteItem {
  id: string;
  name: string;
  adapterKey: string;
  hasApiKey: boolean;
}

interface TradingData {
  balance: KalshiBalance | null;
  marketPositions: KalshiMarketPosition[];
  eventPositions: KalshiEventPosition[];
  fills: KalshiFill[];
  settlements: KalshiSettlement[];
}

function PaginatedTable<T>({
  title,
  items,
  columns,
  emptyMessage,
  pageSize = PAGE_SIZE,
}: {
  title: string;
  items: T[];
  columns: { key: string; header: string; render: (row: T) => React.ReactNode }[];
  emptyMessage: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = page * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h3 className="border-b border-slate-200 px-4 py-3 text-lg font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="p-6 text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className="px-4 py-2 text-slate-900 dark:text-slate-100"
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 dark:border-slate-700">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              第 {page + 1} / {totalPages} 页，共 {items.length} 条
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                第一页
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                下一页
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                最后一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface TradingAccountPageContentProps {
  sites: SiteItem[];
}

export function TradingAccountPageContent({ sites }: TradingAccountPageContentProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TradingData | null>(null);
  const [eventTickerToTitle, setEventTickerToTitle] = useState<Record<string, string>>({});
  const [associatingTicker, setAssociatingTicker] = useState<string | null>(null);

  const sitesWithApiKey = useMemo(
    () => sites.filter((s) => s.adapterKey === "kalshi" && s.hasApiKey),
    [sites]
  );

  const loadTradingData = useCallback(async () => {
    if (!selectedSiteId) {
      toast.error("请先选择站点");
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/sites/${selectedSiteId}/trading-data`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "加载失败");
        return;
      }
      setData(json);
      toast.success("加载成功");
    } catch {
      toast.error("加载失败：网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    setEventTickerToTitle({});
  }, [selectedSiteId]);

  const handleAssociateEvent = useCallback(
    async (eventTicker: string) => {
      if (!selectedSiteId) return;
      setAssociatingTicker(eventTicker);
      try {
        const res = await fetch(`/api/sites/${selectedSiteId}/trading-data/associate-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventTicker }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "关联失败");
          return;
        }
        setEventTickerToTitle((prev) => ({ ...prev, [eventTicker]: json.title }));
        toast.success("关联成功");
      } catch {
        toast.error("关联失败：网络错误，请稍后重试");
      } finally {
        setAssociatingTicker(null);
      }
    },
    [selectedSiteId]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        用户交易账户
      </h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              站点
            </label>
            <select
              value={selectedSiteId ?? ""}
              onChange={(e) => {
                setSelectedSiteId(e.target.value || null);
                setData(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">请选择</option>
              {sitesWithApiKey.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.adapterKey})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={loadTradingData}
              disabled={loading || !selectedSiteId}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {loading ? "加载中…" : "加载"}
            </button>
          </div>
        </div>
        {sitesWithApiKey.length === 0 && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            暂无已配置 API Key 的 Kalshi 站点。请前往{" "}
            <Link
              href="/sites"
              className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
            >
              站点管理
            </Link>{" "}
            添加或编辑站点，配置 API Key ID 和私钥。
          </p>
        )}
      </div>

      {data && (
        <>
          {data.balance && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-medium text-slate-800 dark:text-slate-200">
                账户概览
              </h2>
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">余额</span>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {formatCents(data.balance.balance)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">组合价值</span>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {formatCents(data.balance.portfolio_value)}
                  </p>
                </div>
                {data.balance.updated_ts && (
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">更新时间</span>
                    <p className="text-slate-900 dark:text-slate-100">
                      {formatDate(new Date(data.balance.updated_ts).toISOString())}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <PaginatedTable
            title="市场持仓"
            items={data.marketPositions}
            emptyMessage="暂无市场持仓"
            columns={[
              {
                key: "ticker",
                header: "市场",
                render: (r) => r.ticker ?? "—",
              },
              {
                key: "position",
                header: "持仓",
                render: (r) => r.position_fp ?? String(r.position ?? "—"),
              },
              {
                key: "exposure",
                header: "敞口",
                render: (r) =>
                  r.market_exposure_dollars ?? (r.market_exposure != null ? `$${r.market_exposure}` : "—"),
              },
              {
                key: "pnl",
                header: "已实现盈亏",
                render: (r) =>
                  r.realized_pnl_dollars ?? (r.realized_pnl != null ? `$${r.realized_pnl}` : "—"),
              },
              {
                key: "updated",
                header: "更新时间",
                render: (r) => formatDate(r.last_updated_ts ?? null),
              },
            ]}
          />

          <PaginatedTable
            title="事件持仓"
            items={data.eventPositions}
            emptyMessage="暂无事件持仓"
            columns={[
              {
                key: "event",
                header: "事件",
                render: (r) =>
                  eventTickerToTitle[r.event_ticker ?? ""] ?? r.event_ticker ?? "—",
              },
              {
                key: "associate",
                header: "关联",
                render: (r) => {
                  const ticker = r.event_ticker ?? "";
                  return (
                    <button
                      type="button"
                      onClick={() => handleAssociateEvent(ticker)}
                      disabled={!ticker || associatingTicker === ticker}
                      className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      {associatingTicker === ticker ? "关联中…" : "关联"}
                    </button>
                  );
                },
              },
              {
                key: "cost",
                header: "总成本",
                render: (r) =>
                  r.total_cost_dollars ?? (r.total_cost != null ? `$${r.total_cost}` : "—"),
              },
              {
                key: "exposure",
                header: "敞口",
                render: (r) =>
                  r.event_exposure_dollars ?? (r.event_exposure != null ? `$${r.event_exposure}` : "—"),
              },
              {
                key: "pnl",
                header: "已实现盈亏",
                render: (r) =>
                  r.realized_pnl_dollars ?? (r.realized_pnl != null ? `$${r.realized_pnl}` : "—"),
              },
            ]}
          />

          <PaginatedTable
            title="成交记录"
            items={data.fills}
            emptyMessage="暂无成交记录"
            columns={[
              {
                key: "created",
                header: "时间",
                render: (r) => formatDate(r.created_time ?? null),
              },
              {
                key: "ticker",
                header: "市场",
                render: (r) => r.market_ticker ?? r.ticker ?? "—",
              },
              {
                key: "action",
                header: "方向",
                render: (r) => `${r.action ?? "—"} ${r.side ?? ""}`.trim() || "—",
              },
              {
                key: "count",
                header: "数量",
                render: (r) => r.count_fp ?? String(r.count ?? "—"),
              },
              {
                key: "price",
                header: "价格",
                render: (r) =>
                  r.yes_price_fixed ?? (r.yes_price != null ? String(r.yes_price) : "—"),
              },
              {
                key: "fee",
                header: "手续费",
                render: (r) => r.fee_cost ?? "—",
              },
            ]}
          />

          <PaginatedTable
            title="结算记录"
            items={data.settlements}
            emptyMessage="暂无结算记录"
            columns={[
              {
                key: "ticker",
                header: "市场",
                render: (r) => r.ticker ?? "—",
              },
              {
                key: "event",
                header: "事件",
                render: (r) => r.event_ticker ?? "—",
              },
              {
                key: "result",
                header: "结果",
                render: (r) => r.market_result ?? "—",
              },
              {
                key: "value",
                header: "价值",
                render: (r) =>
                  r.value != null ? `$${r.value}` : r.revenue != null ? `$${r.revenue}` : "—",
              },
              {
                key: "settled",
                header: "结算时间",
                render: (r) => formatDate(r.settled_time ?? null),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
