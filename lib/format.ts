/**
 * Shared formatting utilities for events and markets display.
 * Per date-display-format rule: dates show only date part, no time.
 */

/** Format outcomes as "Yes: 65% | No: 35%" */
export function formatOutcomes(outcomes?: Record<string, number>): string {
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
export function formatUsd(value?: number | null): string {
  if (value == null || typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format ISO date string — date only, no time (per date-display-format rule) */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
