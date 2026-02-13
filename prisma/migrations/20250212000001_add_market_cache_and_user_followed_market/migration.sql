-- CreateTable
CREATE TABLE "MarketCache" (
    "id" TEXT NOT NULL,
    "eventCacheId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "closeTime" TIMESTAMP(3),
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "outcomes" JSONB,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFollowedMarket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketCacheId" TEXT NOT NULL,
    "attentionLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollowedMarket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketCache_siteId_eventCacheId_externalId_key" ON "MarketCache"("siteId", "eventCacheId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollowedMarket_userId_marketCacheId_key" ON "UserFollowedMarket"("userId", "marketCacheId");

-- AddForeignKey
ALTER TABLE "MarketCache" ADD CONSTRAINT "MarketCache_eventCacheId_fkey" FOREIGN KEY ("eventCacheId") REFERENCES "EventCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketCache" ADD CONSTRAINT "MarketCache_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketCache" ADD CONSTRAINT "MarketCache_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollowedMarket" ADD CONSTRAINT "UserFollowedMarket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollowedMarket" ADD CONSTRAINT "UserFollowedMarket_marketCacheId_fkey" FOREIGN KEY ("marketCacheId") REFERENCES "MarketCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;
