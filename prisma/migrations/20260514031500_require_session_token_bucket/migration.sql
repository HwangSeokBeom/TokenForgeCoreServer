UPDATE "SessionSummary"
SET "tokenBucket" = 'NONE'
WHERE "tokenBucket" IS NULL;

ALTER TABLE "SessionSummary"
ALTER COLUMN "tokenBucket" SET NOT NULL;
