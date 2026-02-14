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
import { toast } from "sonner";
import { MAX_SELECTED_MARKETS, DEFAULT_NO_EVALUATION_THRESHOLD } from "@/lib/constants";
import { formatDate, formatOutcomes, formatTradingClose, formatUsd } from "@/lib/format";
import { CopyableText } from "@/components/ui/CopyableText";

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
  /** Trading deadline from Timeline and payout ("Otherwise, it closes by..."). Primary sort key. */
  nextTradingCloseTime?: string;
  /** Projected payout date from Timeline and payout. */
  settlementDate?: string;
  volume?: number;
  liquidity?: number;
  outcomes?: Record<string, number>;
  fetchedAt: string;
  attentionLevel?: number;
  siteName?: string;
  sectionName?: string;
  /** Previous outcomes when market had price change; used in 价格变更市场 for two-line display */
  oldOutcomes?: Record<string, number>;
  /** User's No probability estimate (0-1). */
  noEvaluation?: number;
  /** Threshold for color highlight (0-1). When |noPrice - noEvaluation| > threshold, apply color. */
  threshold?: number;
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
  /** Global threshold (0-1) used when saving new evaluation. Default 0.1. */
  globalThreshold?: number;
  /** Called when user changes global threshold. */
  onGlobalThresholdChange?: (value: number) => void;
  /** Called after no-evaluation saved; parent may refetch. */
  onNoEvaluationChange?: (marketId: string, noProbability: number, threshold: number) => void;
  /** Hint shown near toolbar, e.g. "正在浏览你关注的市场" or "正在浏览站点缓存中的市场" */
  browseContextHint?: string;
}

function NoEvaluationCell({
  marketId,
  value,
  threshold,
  globalThreshold,
  onSave,
}: {
  marketId: string;
  value?: number;
  threshold?: number;
  globalThreshold: number;
  onSave: (marketId: string, noProbability: number, threshold: number) => Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const displayValue = pending ?? (value != null ? String(Math.round(value * 100)) : "");

  const handleBlur = async () => {
    if (pending == null) return;
    const parsed = parseFloat(pending);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setPending(null);
      return;
    }
    const noProbability = Math.max(0, Math.min(1, parsed / 100));
    const th = threshold ?? globalThreshold;
    setPending(null);
    setSaving(true);
    try {
      await onSave(marketId, noProbability, th);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
  };

  return (
    <input
      type="number"
      min={0}
      max={100}
      step={1}
      value={displayValue}
      onChange={(e) => setPending(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="输入 0–100"
      disabled={saving}
      className="w-16 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
    />
  );
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
    const parsed = parseInt(pending, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const n = Math.min(99, parsed);
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
      max={99}
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
  globalThreshold = DEFAULT_NO_EVALUATION_THRESHOLD,
  onGlobalThresholdChange,
  onNoEvaluationChange,
  onSelectionChange,
  onBatchAttentionChange,
  browseContextHint,
}: MarketsTableProps) {
  const highlightSet = useMemo(
    () => new Set(highlightColumns ?? []),
    [highlightColumns]
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: "nextTradingCloseTime", desc: false },
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
      setPagination((p) => ({ ...p, pageSize: effectivePageSize }));
    }
  }, [paginationEnabled, effectivePageSize]);

  useEffect(() => {
    if (!paginationEnabled) return;
    const maxPageIndex = Math.max(0, Math.ceil(markets.length / effectivePageSize) - 1);
    setPagination((p) => {
      if (p.pageIndex <= maxPageIndex) return p;
      return { ...p, pageIndex: maxPageIndex };
    });
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
      table: {
        getFilteredRowModel?: () => { rows: { original: MarketItem }[] };
        getSelectedRowModel?: () => { rows: { original: MarketItem }[] };
      }
    ) => {
      const rows = table?.getFilteredRowModel?.()?.rows ?? [];
      const ids = rows.slice(0, maxSelected).map((r) => (r.original as MarketItem).id);
      const selectedRows = table?.getSelectedRowModel?.()?.rows ?? [];
      const selectedIds = new Set(selectedRows.map((r) => (r.original as MarketItem).id));
      const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
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
                          onChange={() => selectAllLimited(table)}
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
        cell: ({ row }) =>
          row.original.eventTitle ? (
            <CopyableText text={row.original.eventTitle} className="max-w-[320px]" />
          ) : (
            <span>—</span>
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
        id: "nextTradingCloseTime",
        accessorFn: (row) => {
          const v = row.nextTradingCloseTime ?? row.closeTime;
          return v ?? "9999-12-31"; // "After the outcome occurs" sorts last (asc)
        },
        header: "交易截止时间",
        cell: ({ row }) => {
          const text = formatTradingClose(row.original.nextTradingCloseTime ?? row.original.closeTime);
          const hasSettlementDate = Boolean(row.original.settlementDate);
          return (
            <span className={hasSettlementDate ? "" : "text-red-600 dark:text-red-400"}>
              {text}
            </span>
          );
        },
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
          const { outcomes, oldOutcomes, noEvaluation, threshold } = row.original;
          const th = threshold ?? DEFAULT_NO_EVALUATION_THRESHOLD;
          const noPrice = outcomes?.No;
          const diff =
            noEvaluation != null && noPrice != null ? noPrice - noEvaluation : null;
          const noColorClass =
            diff != null && Math.abs(diff) > th
              ? diff > 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
              : "";

          const renderOutcomes = (o: Record<string, number> | undefined, extraClass = "") => {
            if (!o || typeof o !== "object") return <span>—</span>;
            const entries = Object.entries(o);
            if (entries.length === 0) return <span>—</span>;
            return (
              <span className={extraClass}>
                {entries.map(([k, v], i) => {
                  const pct = typeof v === "number" ? Math.round(v * 100) : 0;
                  const isNo = k.toLowerCase() === "no";
                  const cls =
                    isNo && noColorClass ? noColorClass : "text-slate-900 dark:text-slate-100";
                  return (
                    <span key={k}>
                      {i > 0 && " | "}
                      <span className={cls}>{k}: {pct}%</span>
                    </span>
                  );
                })}
              </span>
            );
          };

          if (oldOutcomes != null) {
            return (
              <div className="max-w-[240px] space-y-0.5 text-sm">
                <div className="text-slate-900 dark:text-slate-100" title={formatOutcomes(oldOutcomes)}>
                  <span className="text-slate-500 dark:text-slate-400">旧 </span>
                  {formatOutcomes(oldOutcomes)}
                </div>
                <div className="text-red-600 dark:text-red-400" title={formatOutcomes(outcomes)}>
                  <span className="text-red-600 dark:text-red-400">新 </span>
                  {renderOutcomes(outcomes)}
                </div>
              </div>
            );
          }
          return (
            <div className="max-w-[200px] truncate text-sm" title={formatOutcomes(outcomes)}>
              {renderOutcomes(outcomes)}
            </div>
          );
        },
      },
      ...(onNoEvaluationChange
        ? [
            {
              id: "noEvaluation",
              header: "No 评估",
              cell: ({ row }: { row: { original: MarketItem } }) => {
          const m = row.original;
          const handleSave = async (
            marketId: string,
            noProbability: number,
            threshold: number
          ) => {
            const res = await fetch(`/api/markets/${marketId}/no-evaluation`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noProbability, threshold }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              const msg = (data?.error as string) ?? "保存失败";
              toast.error(`No 评估保存失败：${msg}`);
              throw new Error(msg);
            }
            toast.success("No 评估已保存");
            onNoEvaluationChange?.(marketId, noProbability, threshold);
          };
          return (
            <NoEvaluationCell
              marketId={m.id}
              value={m.noEvaluation}
              threshold={m.threshold}
              globalThreshold={globalThreshold}
              onSave={handleSave}
            />
          );
        },
      } as ColumnDef<MarketItem>,
          ]
        : []),
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
      onNoEvaluationChange,
      globalThreshold,
      selectable,
      enableSelectAll,
      maxSelected,
      selectAllLimited,
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
        {onNoEvaluationChange != null && onGlobalThresholdChange != null && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            No选项评估与价格相差触发警报值%
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round((globalThreshold ?? DEFAULT_NO_EVALUATION_THRESHOLD) * 100)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v >= 0 && v <= 100) {
                  onGlobalThresholdChange(Math.max(0, Math.min(1, v / 100)));
                }
              }}
              className="w-14 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        )}
        {browseContextHint != null && browseContextHint !== "" && (
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-600 dark:bg-blue-500/25 dark:text-blue-200">
            {browseContextHint}
          </span>
        )}
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
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-800"
            >
              第一页
            </button>
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
            <button
              type="button"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-800"
            >
              最后一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
