/**
 * Status values considered active/open for events and markets.
 * Per rule: only active/open items are shown in user tables.
 */
export const ACTIVE_STATUSES = ["open", "active"] as const;

/** Mutable copy for Prisma where { in: [...] } which expects string[]. */
export const ACTIVE_STATUSES_ARRAY: string[] = ["open", "active"];

export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.includes(status.toLowerCase() as (typeof ACTIVE_STATUSES)[number]);
}

export const MAX_SELECTED_EVENTS = 50;
export const MAX_SELECTED_MARKETS = 50;

/** Default threshold for No evaluation color highlight (0.1 = 10%). User input 10 → 0.1. */
export const DEFAULT_NO_EVALUATION_THRESHOLD = 0.1;
