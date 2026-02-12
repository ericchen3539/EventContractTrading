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
  type RowSelectionState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect, useCallback } from "react";
import { MAX_SELECTED_EVENTS } from "@/lib/constants";

/** Event as returned by GET /api/sites/[siteId]/events or GET /api/me/followed-events */
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
  /** From followed-events API; absent for event market (display as 1) */
  attentionLevel?: number;
};

interface EventsTableProps {
  events: EventItem[];
  sectionNameMap: Record<string, string>;
  /** When provided and multiple sites, show site column */
  siteNameMap?: Record<string, string>;
  /** eventId -> attentionLevel; absent = display as 1 */
  attentionMap?: Record<string, number>;
  /** When provided, show attention column for all events */
  onAttentionChange?: (eventId: string, level: number) => void;
  /** Custom empty state message */
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  /** When provided, enable pagination with this page size (e.g. 10). Omit to show all rows. */
  pageSize?: number;
  /** Column accessor keys to render in red (e.g. changed attributes). */
  highlightColumns?: string[];
  /** Enable row selection for batch operations */
  selectable?: boolean;
  /** Show select-all checkbox in header */
  enableSelectAll?: boolean;
  /** Max selected rows (default 50). Enforced on select-all and batch action. */
  maxSelected?: number;
  /** Callback when selection changes */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Batch set attention level for selected events */
  onBatchAttentionChange?: (eventIds: string[], level: number) => void;
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

/** Attention level input: non-negative integer, 0 = 不再关注 */
function AttentionCell({
  eventId,
  value,
  onAttentionChange,
}: {
  eventId: string;
  value: number;
  onAttentionChange: (eventId: string, level: number) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const displayValue = pending ?? String(value);

  const handleBlur = () => {
    if (pending == null) return;
    const n = parseInt(pending, 10);
    if (!Number.isNaN(n) && n >= 0) {
      onAttentionChange(eventId, n);
    }
    setPending(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={displayValue}
      onChange={(e) => setPending(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-14 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
    />
  );
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
  attentionMap,
  onAttentionChange,
  emptyStateMessage,
  emptyStateSubMessage,
  pageSize,
  highlightColumns,
  selectable = false,
  enableSelectAll = false,
  maxSelected = MAX_SELECTED_EVENTS,
  onSelectionChange,
  onBatchAttentionChange,
}: EventsTableProps) {
  const highlightSet = useMemo(
    () => new Set(highlightColumns ?? []),
    [highlightColumns]
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [batchLevel, setBatchLevel] = useState(1);
  const [batchOverflowMsg, setBatchOverflowMsg] = useState<string | null>(null);
  const paginationEnabled = pageSize != null && pageSize > 0;
  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: effectivePageSize,
  });
  useEffect(() => {
    if (paginationEnabled) {
      setPagination((p) => ({
        ...p,
        pageIndex: 0,
        pageSize: effectivePageSize,
      }));
    }
  }, [events, paginationEnabled, effectivePageSize]);

  const handleRowSelectionChange = useCallback(
    (updaterOrValue: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => {
      setRowSelection((prev) => {
        const next = typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue;
        const ids = Object.keys(next).filter((k) => next[k]);
        if (ids.length > maxSelected) {
          const trimmed: RowSelectionState = {};
          for (let i = 0; i < maxSelected; i++) {
            trimmed[ids[i]] = true;
          }
          setBatchOverflowMsg(`最多选择 ${maxSelected} 条`);
          onSelectionChange?.(new Set(ids.slice(0, maxSelected)));
          return trimmed;
        }
        setBatchOverflowMsg(null);
        onSelectionChange?.(new Set(ids));
        return next;
      });
    },
    [maxSelected, onSelectionChange]
  );

  const selectAllLimited = useCallback(
    (table: { getFilteredRowModel: () => { rows: { original: EventItem }[] } }) => {
      const rows = table.getFilteredRowModel().rows;
      const ids = rows.slice(0, maxSelected).map((r) => (r.original as EventItem).id);
      const sel: RowSelectionState = {};
      for (const id of ids) sel[id] = true;
      setRowSelection(sel);
      setBatchOverflowMsg(
        rows.length > maxSelected ? `已选中前 ${maxSelected} 条，超出部分未选` : null
      );
      onSelectionChange?.(new Set(ids));
    },
    [maxSelected, onSelectionChange]
  );

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setBatchOverflowMsg(null);
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  const columns = useMemo<ColumnDef<EventItem>[]>(
    () => [
      ...(selectable
        ? [
            {
              id: "select",
              accessorKey: "id",
              header: enableSelectAll
                ? ({ table }) => (
                    <label
                      className="flex cursor-pointer items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={
                          table.getIsAllRowsSelected() ||
                          table.getIsSomeRowsSelected()
                        }
                        onChange={() => selectAllLimited(table)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                        aria-label="全选"
                      />
                      <span className="text-xs text-slate-500">全选</span>
                    </label>
                  )
                : "选择",
              cell: ({ row, table }) => (
                <input
                  type="checkbox"
                  checked={row.getIsSelected()}
                  onChange={(e) => {
                    const adding = !row.getIsSelected();
                    const currentCount = table.getSelectedRowModel().rows.length;
                    if (adding && currentCount >= maxSelected) {
                      setBatchOverflowMsg(`最多选择 ${maxSelected} 条`);
                      return;
                    }
                    row.getToggleSelectedHandler()(e);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                />
              ),
              enableSorting: false,
            } as ColumnDef<EventItem>,
          ]
        : []),
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
      ...(onAttentionChange
        ? [
            {
              id: "attention",
              header: "关注度",
              cell: ({ row }: { row: { original: EventItem } }) => (
                <AttentionCell
                  eventId={row.original.id}
                  value={
                    row.original.attentionLevel ??
                    attentionMap?.[row.original.id] ??
                    1
                  }
                  onAttentionChange={onAttentionChange}
                />
              ),
            } as ColumnDef<EventItem>,
          ]
        : []),
    ],
    [
      sectionNameMap,
      siteNameMap,
      attentionMap,
      onAttentionChange,
      selectable,
      enableSelectAll,
      maxSelected,
      selectAllLimited,
    ]
  );

  const table = useReactTable({
    data: events,
    columns,
    getRowId: (row) => (row as EventItem).id,
    getPaginationRowModel: paginationEnabled ? getPaginationRowModel() : undefined,
    manualPagination: !paginationEnabled,
    enableRowSelection: selectable,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection: selectable ? rowSelection : undefined,
      ...(paginationEnabled && { pagination }),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: selectable ? handleRowSelectionChange : undefined,
    ...(paginationEnabled && { onPaginationChange: setPagination }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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

  const selectedRows = selectable ? table.getSelectedRowModel().rows : [];
  const selectedIds = selectedRows.map((r) => r.original.id);
  const showBatchBar =
    selectable &&
    selectedIds.length > 0 &&
    onBatchAttentionChange != null;

  const handleBatchApply = useCallback(async () => {
    if (selectedIds.length > maxSelected) {
      setBatchOverflowMsg(`最多选择 ${maxSelected} 条，请减少选择后重试`);
      return;
    }
    const handler = onBatchAttentionChange ?? (() => {});
    try {
      await Promise.resolve(handler(selectedIds, batchLevel));
      clearSelection();
    } catch {
      // Parent handles error display
    }
  }, [
    selectedIds,
    batchLevel,
    maxSelected,
    onBatchAttentionChange,
    clearSelection,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="搜索标题..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {showBatchBar && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              已选 {selectedIds.length} 项
            </span>
            {batchOverflowMsg && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {batchOverflowMsg}
              </span>
            )}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                关注度
              </span>
              <select
                value={batchLevel}
                onChange={(e) => setBatchLevel(parseInt(e.target.value, 10))}
                className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleBatchApply}
              disabled={selectedIds.length > maxSelected}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              批量设置
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              取消选择
            </button>
          </div>
        )}
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
                {row.getVisibleCells().map((cell) => {
                  const isHighlight = highlightSet.has(cell.column.id);
                  return (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 text-sm ${
                        isHighlight
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
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
