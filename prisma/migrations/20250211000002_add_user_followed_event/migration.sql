-- CreateTable
CREATE TABLE "UserFollowedEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventCacheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollowedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFollowedEvent_userId_eventCacheId_key" ON "UserFollowedEvent"("userId", "eventCacheId");

-- AddForeignKey
ALTER TABLE "UserFollowedEvent" ADD CONSTRAINT "UserFollowedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollowedEvent" ADD CONSTRAINT "UserFollowedEvent_eventCacheId_fkey" FOREIGN KEY ("eventCacheId") REFERENCES "EventCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;
