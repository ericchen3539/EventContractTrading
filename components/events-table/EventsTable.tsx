"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect } from "react";

/** Event as returned by GET /api/sites/[siteId]/events */
export type EventItem = {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description?: string;
  /** First market's trading end time (close_time or expiration_time). */
  createdAt?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  fetchedAt: string;
};

interface EventsTableProps {
  events: EventItem[];
  sectionNameMap: Record<string, string>;
  /** When provided and multiple sites, show site column */
  siteNameMap?: Record<string, string>;
  /** When provided, show follow column with 关注/已关注 buttons */
  followedIds?: Set<string>;
  onFollow?: (eventId: string) => void;
  onUnfollow?: (eventId: string) => void;
  /** Custom empty state message */
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  /** When provided, enable pagination with this page size (e.g. 10). Omit to show all rows. */
  pageSize?: number;
}

/** Format outcomes as "Yes: 65% | No: 35%" */
function formatOutcomes(outcomes?: Record<string, number>): string {
  if (!outcomes || typeof outcomes !== "object") return "—";
  const entries = Object.entries(outcomes);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => {
      const pct = typeof v === "number" ? Math.round(v * 100) : 0;
      return `${k}: ${pct}%`;
    })
    .join(" | ");
}

/** Format number as currency (USD) */
function formatUsd(value?: number | null): string {
  if (value == null || typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format ISO date string */
function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Events table powered by TanStack Table.
 * Supports sorting and filtering.
 */
const DEFAULT_PAGE_SIZE = 10;

export function EventsTable({
  events,
  sectionNameMap,
  siteNameMap,
  followedIds,
  onFollow,
  onUnfollow,
  emptyStateMessage,
  emptyStateSubMessage,
  pageSize,
}: EventsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const paginationEnabled = pageSize != null && pageSize > 0;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
  });
  useEffect(() => {
    if (paginationEnabled) {
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }
  }, [events, paginationEnabled]);

  const columns = useMemo<ColumnDef<EventItem>[]>(
    () => [
      ...(siteNameMap
        ? [
            {
              accessorKey: "siteId",
              header: "站点",
              cell: ({ row }: { row: { original: EventItem } }) =>
                siteNameMap[row.original.siteId] ?? row.original.siteId,
            } as ColumnDef<EventItem>,
          ]
        : []),
      {
        accessorKey: "title",
        header: "标题",
        cell: ({ row }) => (
          <div className="max-w-[320px] break-words whitespace-normal" title={row.original.title}>
            {row.original.title}
          </div>
        ),
      },
      {
        accessorKey: "sectionId",
        header: "板块",
        cell: ({ row }) =>
          sectionNameMap[row.original.sectionId] ?? row.original.sectionId,
      },
      {
        accessorKey: "createdAt",
        header: "最近交易结束时间",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "endDate",
        header: "结束日期",
        cell: ({ row }) => formatDate(row.original.endDate),
      },
      {
        accessorKey: "volume",
        header: "交易量",
        cell: ({ row }) => formatUsd(row.original.volume),
      },
      {
        accessorKey: "liquidity",
        header: "流动性",
        cell: ({ row }) => formatUsd(row.original.liquidity),
      },
      {
        accessorKey: "outcomes",
        header: "价格/概率",
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate text-sm" title={formatOutcomes(row.original.outcomes)}>
            {formatOutcomes(row.original.outcomes)}
          </div>
        ),
      },
      {
        accessorKey: "fetchedAt",
        header: "更新时间",
        cell: ({ row }) => formatDate(row.original.fetchedAt),
      },
      ...(onFollow && onUnfollow
        ? [
            {
              id: "follow",
              header: "操作",
              cell: ({ row }: { row: { original: EventItem } }) => {
                const eventId = row.original.id;
                const isFollowed = followedIds?.has(eventId) ?? false;
                return (
                  <div className="flex items-center gap-2">
                    {isFollowed ? (
                      <>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          已关注
                        </span>
                        <button
                          type="button"
                          onClick={() => onUnfollow(eventId)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onFollow(eventId)}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
                      >
                        关注
                      </button>
                    )}
                  </div>
                );
              },
            } as ColumnDef<EventItem>,
          ]
        : []),
    ],
    [sectionNameMap, siteNameMap, followedIds, onFollow, onUnfollow]
  );

  const table = useReactTable({
    data: events,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      ...(paginationEnabled && { pagination }),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    ...(paginationEnabled && { onPaginationChange: setPagination }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginationEnabled && {
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination: false,
    }),
  });

  if (events.length === 0) {
    const main = emptyStateMessage ?? "暂无事件数据";
    const sub =
      emptyStateSubMessage ??
      (emptyStateMessage == null ? "请选择站点并点击「更新」拉取事件。" : undefined);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">{main}</p>
        {sub != null && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">{sub}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="搜索标题..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    <div
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100"
                          : ""
                      }
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? ""}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginationEnabled && (
        <div className="flex items-center justify-between gap-4 px-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            共 {table.getFilteredRowModel().rows.length} 条
            {table.getPageCount() > 1 &&
              `，第 ${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()} 页`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-800"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-800"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
