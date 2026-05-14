# TokenForge Core Server

TokenForge Core Server is the privacy-first NestJS backend for TokenForge, a Unity/macOS companion RPG that converts AI coding-agent and Git work summaries into character growth.

## Server Responsibility

- Account and authentication.
- User profile storage.
- Character snapshot storage and sync.
- Session summary storage.
- Privacy Guard second-pass validation.
- Phase 2 privacy-safe cloud sync foundation.
- Achievement storage foundation.
- Data export/delete.
- Health check.

## Client/Server Boundary

The server is not a raw development-data analyzer. It must never receive or store raw prompts, code, terminal output, full logs, absolute paths, Git remote URLs, branch names, commit messages, diffs, or patches.

The Unity client is responsible for local analysis and first-pass sanitization. The server accepts only Safe Sync DTOs and SessionSummary DTOs made from privacy-safe aggregate values.

## Privacy-First Rules

Never send these fields to the server: `prompt`, `rawPrompt`, `rawDiff`, `code`, `rawCode`, `sourceCode`, `log`, `rawLog`, `claudeLog`, `codexLog`, `terminalOutput`, `stdout`, `stderr`, `absolutePath`, `filePath`, `path`, `pathRaw`, `remoteUrl`, `gitRemote`, `branchName`, `rawBranchName`, `commitMessage`, `rawCommitMessage`, `diff`, `patch`, `command`, `commandText`, `authorization`, `apiKey`, `secret`, `passwordRaw`, `tokenRaw`, `rawToken`, `apiToken`, `accessToken`, `secretToken`.

`refreshToken` is accepted only by auth endpoints. `tokenBucket` is the only token aggregate accepted by session summary sync.

## Session Summary Idempotency

`POST /sessions/summary` is idempotent per `userId + sessionId`. Re-uploading the same `sessionId` for the same user updates the existing safe aggregate row, clears a prior soft-delete for that row, and increments its sync state. Raw prompts, code, logs, paths, remotes, branches, commits, diffs, patches, command text, stdout, and stderr are never accepted or returned.

## Phase 2 Safe Sync API

All routes are versioned under `/api/v1` and require `Authorization: Bearer <accessToken>`.

### `POST /api/v1/sync/push`

Accepts only explicit privacy-safe fields. Unknown DTO fields are rejected, and the Privacy Guard rejects forbidden key names recursively before persistence.

Safe example:

```json
{
  "idempotencyKey": "sync-safe-0001",
  "clientRevision": 1,
  "sessionSummaries": [
    {
      "sessionId": "session_opaque_001",
      "agentType": "codex",
      "workType": "FEATURE",
      "startedAt": "2026-05-14T00:00:00.000Z",
      "durationBucket": "M_15_30",
      "tokenBucket": "SMALL",
      "changedFileCountBucket": "FEW",
      "addedLineBucket": "FEW",
      "deletedLineBucket": "ONE",
      "testRunCount": 1,
      "buildRunCount": 0,
      "resultStatus": "SUCCESS",
      "expGained": 300,
      "statDeltas": { "logic": 10 },
      "confidence": "HIGH",
      "sourceProvider": "CODEX",
      "projectHash": "0123456789abcdef"
    }
  ],
  "achievements": [
    {
      "achievementId": "FIRST_SAFE_SYNC",
      "sourceProvider": "UNITY_CLIENT",
      "progress": { "currentValue": 1, "targetValue": 1, "completed": true }
    }
  ]
}
```

Response shape:

```json
{
  "status": "ok",
  "policy": "additive-upsert",
  "serverRevision": 3,
  "accepted": {
    "character": 0,
    "sessionSummaries": 1,
    "achievements": 1,
    "profile": 0,
    "settings": 0
  },
  "serverTime": "2026-05-14T00:00:00.000Z"
}
```

### `GET /api/v1/sync/pull`

Returns the authenticated user's additive/upsert-safe state:

```json
{
  "policy": "additive-upsert",
  "serverRevision": 3,
  "profile": { "settings": { "cloudSyncOptIn": true }, "updatedAt": "2026-05-14T00:00:00.000Z" },
  "character": null,
  "sessionSummaries": [],
  "achievements": [
    {
      "achievementId": "FIRST_SAFE_SYNC",
      "title": "FIRST_SAFE_SYNC",
      "description": "Client-synced privacy-safe achievement.",
      "unlockedAt": "2026-05-14T00:00:00.000Z",
      "progress": null,
      "sourceProvider": "UNITY_CLIENT",
      "serverRevision": 3
    }
  ]
}
```

The pull response intentionally omits Prisma internal IDs, `userId`, soft-delete markers, raw sync state rows, and delete/tombstone instructions.

`POST /api/v1/sync/full` is not implemented yet. The current Unity Phase 2 merge behavior is additive/upsert-only, and no tombstone contract exists, so push and pull stay separate to avoid implying unsupported conflict or delete behavior.

## Safe Sync Limitations

- Production login hardening may still be pending for deployment environments; the current auth foundation supports guest/email JWT flows.
- No delete/tombstone sync contract yet.
- No Claude/Codex raw log parsing on the server.
- No raw Git execution or raw AI log ingestion on the server.
- The server accepts only privacy-safe aggregate client payloads and safe opaque IDs.

## Environment

Copy `.env.example` to `.env` and set real local values:

```bash
cp .env.example .env
```

Required variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `CORS_ORIGIN`
- `BCRYPT_SALT_ROUNDS`

## Local Run

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Test

```bash
npm test
```

## API List

- `GET /api/v1/health`
- `POST /api/v1/auth/guest`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `DELETE /api/v1/auth/account`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/characters/me`
- `PUT /api/v1/characters/me/snapshot`
- `GET /api/v1/characters/me/history`
- `POST /api/v1/sessions/summary`
- `GET /api/v1/sessions/summary`
- `DELETE /api/v1/sessions/summary/:id`
- `GET /api/v1/sync/pull`
- `POST /api/v1/sync/push`
- `GET /api/v1/achievements`
- `GET /api/v1/achievements/me`
- `GET /api/v1/privacy/export`
- `DELETE /api/v1/privacy/data`

## Phase 1 Notes

Implemented endpoints are MVP-grade. `PATCH /characters/me/stats`, `POST /achievements/evaluate`, Steamworks integration, WebSocket sync, public leaderboard, payments, and complex anti-cheat are intentionally out of scope.

## Next Phase

- Add production deployment config.
- Add database-backed e2e tests with disposable PostgreSQL.
- Add OpenAPI documentation.
- Define exact token bucket and EXP balance tables.
- Expand sync conflict handling beyond additive/upsert.
- Define a delete/tombstone contract before adding remote deletion sync.
- Add privacy consent flows for optional project aliases.
