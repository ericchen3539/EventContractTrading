"use client";

/**
 * My sites multi-select: blank, Kalshi, PolyMarket.
 * Blank is default; selecting blank counts as "no selection" for event triggering.
 */
export type SiteOption = "" | "kalshi" | "polymarket";

const SITE_OPTIONS: { value: SiteOption; label: string }[] = [
  { value: "", label: "空白" },
  { value: "kalshi", label: "Kalshi" },
  { value: "polymarket", label: "PolyMarket" },
];

interface SiteOptionsSelectorProps {
  selected: Set<SiteOption>;
  onChange: (selected: Set<SiteOption>) => void;
}

export function SiteOptionsSelector({ selected, onChange }: SiteOptionsSelectorProps) {
  const toggle = (value: SiteOption) => {
    onChange(
      new Set(
        selected.has(value)
          ? [...selected].filter((v) => v !== value)
          : [...selected, value]
      )
    );
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        我的站点
      </label>
      <div className="flex flex-wrap gap-2">
        {SITE_OPTIONS.map((opt) => (
          <label
            key={opt.value || "blank"}
            className="flex cursor-pointer items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={selected.has(opt.value)}
              onChange={() => toggle(opt.value)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-700 focus:ring-zinc-500 dark:border-zinc-600"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
