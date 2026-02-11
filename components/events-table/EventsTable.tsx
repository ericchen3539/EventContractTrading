"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";

/** Event as returned by GET /api/sites/[siteId]/events */
export type EventItem = {
  id: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  description?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  fetchedAt: string;
};

interface EventsTableProps {
  events: EventItem[];
  sectionNameMap: Record<string, string>;
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
export function EventsTable({ events, sectionNameMap }: EventsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<EventItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "标题",
        cell: ({ row }) => (
          <div className="max-w-[320px] truncate" title={row.original.title}>
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
        header: "刷新时间",
        cell: ({ row }) => formatDate(row.original.fetchedAt),
      },
    ],
    [sectionNameMap]
  );

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">暂无事件数据</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
          请选择站点并点击「刷新」拉取事件。
        </p>
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
          className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    <div
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
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
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
