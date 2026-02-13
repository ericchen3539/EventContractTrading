-- Add settlementDate to Market (Projected payout from Timeline and payout)
ALTER TABLE "Market" ADD COLUMN "settlementDate" TIMESTAMP(3);
