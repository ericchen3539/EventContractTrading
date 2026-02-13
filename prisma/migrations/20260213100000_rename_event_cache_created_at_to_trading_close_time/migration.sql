-- Rename EventCache.createdAt to tradingCloseTime (semantic: 最近交易截止时间)
ALTER TABLE "EventCache" RENAME COLUMN "createdAt" TO "tradingCloseTime";
