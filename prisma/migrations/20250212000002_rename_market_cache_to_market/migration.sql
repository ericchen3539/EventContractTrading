-- Rename MarketCache to Market (preserve data, same structure)
ALTER TABLE "MarketCache" RENAME TO "Market";

-- Rename UserFollowedMarket column and constraints
ALTER TABLE "UserFollowedMarket" RENAME COLUMN "marketCacheId" TO "marketId";

-- Update unique index name for clarity
ALTER INDEX "UserFollowedMarket_userId_marketCacheId_key" RENAME TO "UserFollowedMarket_userId_marketId_key";

-- Update FK constraint name for clarity
ALTER TABLE "UserFollowedMarket" RENAME CONSTRAINT "UserFollowedMarket_marketCacheId_fkey" TO "UserFollowedMarket_marketId_fkey";

-- Update Market table unique index name
ALTER INDEX "MarketCache_siteId_eventCacheId_externalId_key" RENAME TO "Market_siteId_eventCacheId_externalId_key";
