-- AlterTable: add progress tracking fields to ScrapeLog
ALTER TABLE "ScrapeLog" ADD COLUMN IF NOT EXISTS "processedMRs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScrapeLog" ADD COLUMN IF NOT EXISTS "failedMRs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScrapeLog" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ScrapeLog" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Rename createdAt to keep it, rename status values are just strings so no migration needed
-- Add index on scrapeDate
CREATE INDEX IF NOT EXISTS "ScrapeLog_scrapeDate_idx" ON "ScrapeLog"("scrapeDate");
