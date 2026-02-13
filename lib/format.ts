/**
 * Shared formatting utilities for events and markets display.
 * Per date-display-format rule: dates show date and time (minutes), no seconds.
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

/** Format cents as USD (e.g. Kalshi API returns balance in cents) */
export function formatCents(value?: number | null): string {
  if (value == null || typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/** Format ISO date string — date and time (minutes), no seconds (per date-display-format rule) */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Display label when market closes "After the outcome occurs" (no fixed close time). */
export const TRADING_CLOSE_AFTER_OUTCOME = "After the outcome occurs";

/** Format trading close time: date or "After the outcome occurs" when null. */
export function formatTradingClose(iso?: string | null): string {
  if (!iso) return TRADING_CLOSE_AFTER_OUTCOME;
  return formatDate(iso);
}
