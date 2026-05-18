-- Safe Sync activity-session aggregate storage. No raw paths, filenames, prompts, responses, commands, logs, source snippets, usernames, tokens, secrets, repository names, or branch names are stored.

CREATE TYPE "ActivitySourceProvider" AS ENUM (
  'MANUAL',
  'GIT',
  'CLAUDE',
  'CODEX',
  'UNKNOWN_AGENT'
);

CREATE TABLE "ActivitySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientSessionId" TEXT NOT NULL,
  "sourceProvider" "ActivitySourceProvider" NOT NULL,
  "dayBucket" TEXT NOT NULL,
  "timeBucket" TEXT,
  "confidence" "ConfidenceBand" NOT NULL,
  "analyzerVersion" TEXT,
  "parserVersion" TEXT,
  "aggregateSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "hashedRepositoryId" TEXT,
  "changeCountBucket" "CountBucket",
  "lineCountBucket" "CountBucket",
  "commitCountBucket" "CountBucket",
  "sessionCountBucket" "CountBucket",
  "interactionCountBucket" "CountBucket",
  "activityCategory" TEXT,
  "durationBucket" "DurationBucket",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySessionWarning" (
  "id" TEXT NOT NULL,
  "activitySessionId" TEXT NOT NULL,
  "warningId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivitySessionWarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySessionCategoryBucket" (
  "id" TEXT NOT NULL,
  "activitySessionId" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "countBucket" "CountBucket" NOT NULL,
  CONSTRAINT "ActivitySessionCategoryBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySessionLanguageBucket" (
  "id" TEXT NOT NULL,
  "activitySessionId" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "countBucket" "CountBucket" NOT NULL,
  CONSTRAINT "ActivitySessionLanguageBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivitySessionToolBucket" (
  "id" TEXT NOT NULL,
  "activitySessionId" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "countBucket" "CountBucket" NOT NULL,
  CONSTRAINT "ActivitySessionToolBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivitySession_userId_clientSessionId_key" ON "ActivitySession"("userId", "clientSessionId");
CREATE INDEX "ActivitySession_userId_idx" ON "ActivitySession"("userId");
CREATE INDEX "ActivitySession_sourceProvider_idx" ON "ActivitySession"("sourceProvider");
CREATE INDEX "ActivitySession_dayBucket_idx" ON "ActivitySession"("dayBucket");
CREATE INDEX "ActivitySession_createdAt_idx" ON "ActivitySession"("createdAt");
CREATE INDEX "ActivitySession_userId_dayBucket_idx" ON "ActivitySession"("userId", "dayBucket");

CREATE UNIQUE INDEX "ActivitySessionWarning_activitySessionId_warningId_key" ON "ActivitySessionWarning"("activitySessionId", "warningId");
CREATE INDEX "ActivitySessionWarning_activitySessionId_idx" ON "ActivitySessionWarning"("activitySessionId");
CREATE UNIQUE INDEX "ActivitySessionCategoryBucket_activitySessionId_bucketKey_key" ON "ActivitySessionCategoryBucket"("activitySessionId", "bucketKey");
CREATE INDEX "ActivitySessionCategoryBucket_activitySessionId_idx" ON "ActivitySessionCategoryBucket"("activitySessionId");
CREATE UNIQUE INDEX "ActivitySessionLanguageBucket_activitySessionId_bucketKey_key" ON "ActivitySessionLanguageBucket"("activitySessionId", "bucketKey");
CREATE INDEX "ActivitySessionLanguageBucket_activitySessionId_idx" ON "ActivitySessionLanguageBucket"("activitySessionId");
CREATE UNIQUE INDEX "ActivitySessionToolBucket_activitySessionId_bucketKey_key" ON "ActivitySessionToolBucket"("activitySessionId", "bucketKey");
CREATE INDEX "ActivitySessionToolBucket_activitySessionId_idx" ON "ActivitySessionToolBucket"("activitySessionId");

ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionWarning" ADD CONSTRAINT "ActivitySessionWarning_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionCategoryBucket" ADD CONSTRAINT "ActivitySessionCategoryBucket_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionLanguageBucket" ADD CONSTRAINT "ActivitySessionLanguageBucket_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySessionToolBucket" ADD CONSTRAINT "ActivitySessionToolBucket_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
