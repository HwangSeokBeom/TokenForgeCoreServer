-- Privacy-safe MVP hardening.
-- Session summaries keep only coarse aggregates and identifiers approved by the
-- server contract. Character snapshots gain only bounded safe-state JSON fields.

ALTER TABLE "Character"
ADD COLUMN "evolution" JSONB,
ADD COLUMN "appearance" JSONB,
ADD COLUMN "unlockedItems" JSONB;

DROP TABLE IF EXISTS "WorkTypeDistribution";

ALTER TABLE "SessionSummary"
DROP COLUMN IF EXISTS "tokenRange",
DROP COLUMN IF EXISTS "projectAlias";
