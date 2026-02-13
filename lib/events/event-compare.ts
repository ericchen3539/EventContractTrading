/**
 * Event comparison helpers for EventCache upsert logic.
 * Compares only 最近交易截止时间 (nextTradingCloseTime) and 结束日期 (endDate).
 */
import type { EventMarketInput } from "@/lib/adapters/types";

export function hasSemanticChanges(
  ev: EventMarketInput,
  existing: {
    nextTradingCloseTime: Date | null;
    endDate: Date | null;
  }
): boolean {
  const evTradingClose = ev.nextTradingCloseTime ? ev.nextTradingCloseTime.getTime() : null;
  const exTradingClose = existing.nextTradingCloseTime ? existing.nextTradingCloseTime.getTime() : null;
  if (evTradingClose !== exTradingClose) return true;
  const evEnd = ev.endDate ? ev.endDate.getTime() : null;
  const exEnd = existing.endDate ? existing.endDate.getTime() : null;
  if (evEnd !== exEnd) return true;
  return false;
}
