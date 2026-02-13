-- Rename tradingCloseTime to nextTradingCloseTime (EventCache and Market)
ALTER TABLE "EventCache" RENAME COLUMN "tradingCloseTime" TO "nextTradingCloseTime";
ALTER TABLE "Market" RENAME COLUMN "tradingCloseTime" TO "nextTradingCloseTime";
