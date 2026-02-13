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
import { MAX_SELECTED_MARKETS } from "@/lib/constants";

/** Market as returned by GET /api/sites/[siteId]/markets/cached or GET /api/me/followed-markets */
export type MarketItem = {
  id: string;
  eventCacheId: string;
  siteId: string;
  sectionId: string;
  externalId: string;
  title: string;
  eventTitle?: string;
  closeTime?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  fetchedAt: string;
  attentionLevel?: number;
  siteName?: string;
  sectionName?: string;
  /** Previous outcomes when market had price change; used in 价格变更市场 for two-line display */
  oldOutcomes?: Record<string, number>;
};

interface MarketsTableProps {
  markets: MarketItem[];
  sectionNameMap: Record<string, string>;
  siteNameMap?: Record<string, string>;
  attentionMap?: Record<string, number>;
  onAttentionChange?: (marketId: string, level: number) => void;
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  pageSize?: number;
  highlightColumns?: string[];
  selectable?: boolean;
  enableSelectAll?: boolean;
  maxSelected?: number;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchAttentionChange?: (marketIds: string[], level: number) => void;
}

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

function formatUsd(value?: number | null): string {
  if (value == null || typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

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

function AttentionCell({
  marketId,
  value,
  onAttentionChange,
}: {
  marketId: string;
  value: number;
  onAttentionChange: (marketId: string, level: number) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const displayValue = pending ?? String(value);

  const handleBlur = () => {
    if (pending == null) return;
    const n = parseInt(pending, 10);
    if (!Number.isNaN(n) && n >= 0) {
      onAttentionChange(marketId, n);
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

const DEFAULT_PAGE_SIZE = 10;

export function MarketsTable({
  markets,
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
  maxSelected = MAX_SELECTED_MARKETS,
  onSelectionChange,
  onBatchAttentionChange,
}: MarketsTableProps) {
  const highlightSet = useMemo(
    () => new Set(highlightColumns ?? []),
    [highlightColumns]
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "closeTime", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [batchOverflowMsg, setBatchOverflowMsg] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchModalLevel, setBatchModalLevel] = useState(1);
  const [batchApplying, setBatchApplying] = useState(false);
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
  }, [markets, paginationEnabled, effectivePageSize]);

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

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setBatchOverflowMsg(null);
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  const selectAllLimited = useCallback(
    (
      table: { getFilteredRowModel?: () => { rows: { original: MarketItem }[] } },
      currentSelection: RowSelectionState
    ) => {
      const rows = table?.getFilteredRowModel?.()?.rows ?? [];
      const ids = rows.slice(0, maxSelected).map((r) => (r.original as MarketItem).id);
      const allSelected =
        ids.length > 0 && ids.every((id) => currentSelection[id]);
      if (allSelected) {
        clearSelection();
        return;
      }
      const sel: RowSelectionState = {};
      for (const id of ids) sel[id] = true;
      setRowSelection(sel);
      setBatchOverflowMsg(
        rows.length > maxSelected ? `已选中前 ${maxSelected} 条，超出部分未选` : null
      );
      onSelectionChange?.(new Set(ids));
    },
    [maxSelected, onSelectionChange, clearSelection]
  );

  const columns = useMemo<ColumnDef<MarketItem>[]>(
    () => [
      ...(selectable
        ? [
            {
              id: "select",
              accessorKey: "id",
              header: enableSelectAll
                ? ({ table }) => {
                    if (!table) return <span className="text-xs text-slate-500">选择</span>;
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={
                            table.getIsAllRowsSelected?.() ||
                            table.getIsSomeRowsSelected?.()
                          }
                          onChange={() => selectAllLimited(table, rowSelection)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                          aria-label="全选"
                        />
                        <span className="text-xs text-slate-500">全选</span>
                      </label>
                    );
                  }
                : "选择",
              cell: ({ row, table }) => {
                const toggleHandler = row.getToggleSelectedHandler?.();
                return (
                  <input
                    type="checkbox"
                    checked={row.getIsSelected?.() ?? false}
                    onChange={(e) => {
                      if (!toggleHandler) return;
                      const adding = !row.getIsSelected?.();
                      const currentCount = table?.getSelectedRowModel?.()?.rows?.length ?? 0;
                      if (adding && currentCount >= maxSelected) {
                        setBatchOverflowMsg(`最多选择 ${maxSelected} 条`);
                        return;
                      }
                      toggleHandler(e);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                  />
                );
              },
              enableSorting: false,
            } as ColumnDef<MarketItem>,
          ]
        : []),
      ...(siteNameMap
        ? [
            {
              accessorKey: "siteId",
              header: "站点",
              cell: ({ row }: { row: { original: MarketItem } }) =>
                siteNameMap[row.original.siteId] ?? row.original.siteId,
            } as ColumnDef<MarketItem>,
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
        accessorKey: "eventTitle",
        header: "所属事件",
        cell: ({ row }) => (
          <div className="max-w-[320px] truncate" title={row.original.eventTitle}>
            {row.original.eventTitle ?? "—"}
          </div>
        ),
      },
      {
        accessorKey: "sectionId",
        header: "板块",
        cell: ({ row }) =>
          sectionNameMap[row.original.sectionId] ??
          row.original.sectionName ??
          row.original.sectionId,
      },
      {
        accessorKey: "closeTime",
        header: "截止时间",
        cell: ({ row }) => formatDate(row.original.closeTime),
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
        cell: ({ row }) => {
          const { outcomes, oldOutcomes } = row.original;
          if (oldOutcomes != null) {
            return (
              <div className="max-w-[240px] space-y-0.5 text-sm">
                <div className="text-slate-900 dark:text-slate-100" title={formatOutcomes(oldOutcomes)}>
                  <span className="text-slate-500 dark:text-slate-400">旧 </span>
                  {formatOutcomes(oldOutcomes)}
                </div>
                <div className="text-red-600 dark:text-red-400" title={formatOutcomes(outcomes)}>
                  <span className="text-red-600 dark:text-red-400">新 </span>
                  {formatOutcomes(outcomes)}
                </div>
              </div>
            );
          }
          return (
            <div className="max-w-[200px] truncate text-sm" title={formatOutcomes(outcomes)}>
              {formatOutcomes(outcomes)}
            </div>
          );
        },
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
              cell: ({ row }: { row: { original: MarketItem } }) => (
                <AttentionCell
                  marketId={row.original.id}
                  value={
                    row.original.attentionLevel ??
                    attentionMap?.[row.original.id] ??
                    1
                  }
                  onAttentionChange={onAttentionChange}
                />
              ),
            } as ColumnDef<MarketItem>,
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
      rowSelection,
    ]
  );

  const table = useReactTable({
    data: markets,
    columns,
    getRowId: (row) => (row as MarketItem).id,
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

  const selectedRows = selectable ? table.getSelectedRowModel?.()?.rows ?? [] : [];
  const selectedIds = selectedRows
    .map((r) => (r.original as MarketItem)?.id)
    .filter((id): id is string => typeof id === "string");
  const showBatchBar =
    selectable &&
    selectedIds.length > 0 &&
    onBatchAttentionChange != null;

  const handleBatchConfirm = useCallback(
    async (level: number) => {
      if (selectedIds.length > maxSelected) {
        setBatchOverflowMsg(`最多选择 ${maxSelected} 条，请减少选择后重试`);
        return;
      }
      if (level < 0 || !Number.isInteger(level)) {
        return;
      }
      const handler = onBatchAttentionChange ?? (() => {});
      setBatchApplying(true);
      try {
        await Promise.resolve(handler(selectedIds, level));
        setShowBatchModal(false);
        clearSelection();
      } catch {
        // Parent handles error display
      } finally {
        setBatchApplying(false);
      }
    },
    [selectedIds, maxSelected, onBatchAttentionChange, clearSelection]
  );

  if (markets.length === 0) {
    const main = emptyStateMessage ?? "暂无市场数据";
    const sub =
      emptyStateSubMessage ??
      (emptyStateMessage == null ? "请先在事件更新页面点击「更新所有市场」拉取市场。" : undefined);
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
            <button
              type="button"
              onClick={() => {
                setShowBatchModal(true);
                setBatchModalLevel(1);
              }}
              disabled={selectedIds.length > maxSelected}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              批量修改
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
        {showBatchModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => !batchApplying && setShowBatchModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-modal-title"
          >
            <div
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="batch-modal-title"
                className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-200"
              >
                批量修改关注度
              </h2>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                将已选 {selectedIds.length} 项市场的关注度修改为：
              </p>
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={batchModalLevel}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const n = Number.isNaN(v) ? 0 : Math.max(0, Math.floor(v));
                    setBatchModalLevel(n);
                  }}
                  className="w-24 rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={batchApplying}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !batchApplying && setShowBatchModal(false)}
                  disabled={batchApplying}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchConfirm(batchModalLevel)}
                  disabled={batchApplying}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {batchApplying ? "处理中…" : "确认"}
                </button>
              </div>
            </div>
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
