"use client";

/**
 * My sections multi-select: blank, Politics, other (placeholder).
 * Blank is default; selecting blank counts as "no selection" for event triggering.
 */
export type SectionOption = "" | "politics" | "other";

const SECTION_OPTIONS: { value: SectionOption; label: string }[] = [
  { value: "", label: "空白" },
  { value: "politics", label: "Politics" },
  { value: "other", label: "其他" },
];

interface SectionOptionsSelectorProps {
  selected: Set<SectionOption>;
  onChange: (selected: Set<SectionOption>) => void;
}

export function SectionOptionsSelector({ selected, onChange }: SectionOptionsSelectorProps) {
  const toggle = (value: SectionOption) => {
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
        我的板块
      </label>
      <div className="flex flex-wrap gap-2">
        {SECTION_OPTIONS.map((opt) => (
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
