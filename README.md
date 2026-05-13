# TokenForge Core Server

TokenForge Core Server is the privacy-first NestJS backend for TokenForge, a Unity/macOS companion RPG that converts AI coding-agent and Git work summaries into character growth.

## Server Responsibility

- Account and authentication.
- User profile storage.
- Character snapshot storage and sync.
- Session summary storage.
- Privacy Guard second-pass validation.
- Cloud sync skeleton.
- Achievement storage foundation.
- Data export/delete.
- Health check.

## Client/Server Boundary

The server is not a raw development-data analyzer. It must never receive or store raw prompts, code, terminal output, full logs, absolute paths, Git remote URLs, branch names, commit messages, diffs, or patches.

The Unity client is responsible for local analysis and first-pass sanitization. The server accepts only Safe Sync DTOs and SessionSummary DTOs made from privacy-safe aggregate values.

## Privacy-First Rules

Never send these fields to the server: `prompt`, `rawPrompt`, `code`, `rawCode`, `log`, `rawLog`, `terminalOutput`, `stdout`, `stderr`, `diff`, `patch`, `filePath`, `absolutePath`, `gitRemoteUrl`, `branchNameRaw`, `commitMessageRaw`, `apiKey`, `secret`, `rawToken`, `apiToken`, `accessToken`, `secretToken`.

`refreshToken` is accepted only by auth endpoints. `tokenBucket` and `tokenRange` are safe aggregate fields and are allowed.

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

- `GET /health`
- `POST /auth/guest`
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `DELETE /auth/account`
- `GET /users/me`
- `PATCH /users/me`
- `GET /characters/me`
- `PUT /characters/me/snapshot`
- `GET /characters/me/history`
- `POST /sessions/summary`
- `GET /sessions/summary`
- `DELETE /sessions/summary/:id`
- `POST /sync/pull`
- `POST /sync/push`
- `GET /achievements`
- `GET /achievements/me`
- `GET /privacy/export`
- `DELETE /privacy/data`

## Phase 1 Notes

Implemented endpoints are MVP-grade. `PATCH /characters/me/stats`, `POST /achievements/evaluate`, Steamworks integration, WebSocket sync, public leaderboard, payments, and complex anti-cheat are intentionally out of scope.

## Next Phase

- Add production deployment config.
- Add database-backed e2e tests with disposable PostgreSQL.
- Add OpenAPI documentation.
- Define exact token bucket and EXP balance tables.
- Expand sync conflict handling beyond last-write-wins.
- Add privacy consent flows for optional project aliases.
