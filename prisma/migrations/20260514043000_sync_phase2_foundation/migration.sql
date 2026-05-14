-- Phase 2 privacy-safe sync foundation.
-- Adds monotonic per-row server revision metadata and indexes needed for
-- additive/upsert cloud sync without storing raw local development content.

ALTER TABLE "Character"
ADD COLUMN "serverRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SessionSummary"
ADD COLUMN "serverRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "UserAchievement"
ADD COLUMN "serverRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SyncState"
ADD COLUMN "serverRevision" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Character_serverRevision_idx" ON "Character"("serverRevision");
CREATE INDEX "SessionSummary_userId_serverRevision_idx" ON "SessionSummary"("userId", "serverRevision");
CREATE INDEX "SessionSummary_sourceProvider_idx" ON "SessionSummary"("sourceProvider");
CREATE INDEX "UserAchievement_userId_serverRevision_idx" ON "UserAchievement"("userId", "serverRevision");
CREATE INDEX "SyncState_userId_serverRevision_idx" ON "SyncState"("userId", "serverRevision");
