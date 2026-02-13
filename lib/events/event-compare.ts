/**
 * Event comparison helpers for EventCache upsert logic.
 * Compares only 最近交易截止时间 (createdAt) and 结束日期 (endDate).
 */
import type { EventMarketInput } from "@/lib/adapters/types";

export function hasSemanticChanges(
  ev: EventMarketInput,
  existing: {
    createdAt: Date | null;
    endDate: Date | null;
  }
): boolean {
  const evCreated = ev.createdAt ? ev.createdAt.getTime() : null;
  const exCreated = existing.createdAt ? existing.createdAt.getTime() : null;
  if (evCreated !== exCreated) return true;
  const evEnd = ev.endDate ? ev.endDate.getTime() : null;
  const exEnd = existing.endDate ? existing.endDate.getTime() : null;
  if (evEnd !== exEnd) return true;
  return false;
}
