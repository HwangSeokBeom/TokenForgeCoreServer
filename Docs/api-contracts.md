# API Contracts

## Safe Sync Activity Sessions

Safe Sync activity sessions are aggregate-only payloads produced by the Unity client `SafeSyncMapper`. The server does not analyze repositories, scan Git, parse AI logs, or accept raw local development data.

Contract fixtures:

- `test/fixtures/safe-sync/unity-safe-syncmapper-v1.valid.json`
- `test/fixtures/safe-sync/unity-safe-syncmapper-v1.mixed.json`
- `test/fixtures/safe-sync/unity-safe-syncmapper-v1.unsafe.json`
- `test/fixtures/client-contract-bundles/unity-safe-sync-contract-v1.bundle.json`

OpenAPI document:

- `Docs/openapi/safe-sync.openapi.yaml`

### Endpoints

- `POST /api/v1/sync/activity-sessions`
- `GET /api/v1/sync/activity-sessions`
- `DELETE /api/v1/sync/activity-sessions/:id`
- `GET /api/v1/sync/health`

`POST`, `GET`, and `DELETE` use the current JWT identity. Ownership is scoped by user id. Upsert idempotency is `userId + clientSessionId`.

### Unity Client Contract Bundle

The Unity client can export a JSON bundle with this shape:

```json
{
  "bundleVersion": 1,
  "clientName": "TokenForgeUnityClient",
  "clientSchemaVersion": 1,
  "generatedAt": "2026-05-14T00:00:00.000Z",
  "safeSyncMapperVersion": "unity-safe-sync-mapper.contract-v1",
  "supportedSourceProviders": ["MANUAL", "GIT", "CLAUDE", "CODEX", "UNKNOWN_AGENT"],
  "supportedSchemaVersions": [1],
  "mixedBehavior": "WHOLE_REQUEST_REJECTED_BY_DTO_VALIDATION",
  "fixtures": {
    "valid": { "schemaVersion": 1, "sessions": [] },
    "mixed": { "schemaVersion": 1, "sessions": [] },
    "unsafe": { "schemaVersion": 1, "sessions": [] }
  },
  "privacyExpectations": {
    "approvedLocationsAreLocalOnly": true,
    "rawFieldsNeverSynced": ["prompt", "rawLog", "path"]
  }
}
```

The server validates this bundle without Unity installed. By default, it uses the server-side expected bundle:

```bash
npm run client-contract:validate
```

To validate a bundle copied from Unity CI or a local client checkout:

```bash
npm run client-contract:validate -- --bundle path/to/unity-safe-sync-contract-v1.bundle.json
```

The validator checks bundle version, schema version, source provider enum drift, OpenAPI enum drift, privacy expectations, valid fixture DTO/service acceptance, unsafe fixture privacy rejection, and current mixed fixture behavior.

### Request Shape

```json
{
  "schemaVersion": 1,
  "clientSyncId": "unity-sync-v1-001",
  "sessions": [
    {
      "clientSessionId": "unity-git-20260514-001",
      "sourceProvider": "GIT",
      "dayBucket": "2026-05-14",
      "timeBucket": "HOUR_09",
      "confidence": "HIGH",
      "analyzerVersion": "unity-git-analyzer.1",
      "parserVersion": "safe-sync.1",
      "hashedRepositoryId": "0123456789abcdef",
      "changeCountBucket": "FEW",
      "lineCountBucket": "MANY",
      "commitCountBucket": "ONE",
      "warningIds": ["LOW_CONFIDENCE_RANGE"],
      "categoryBuckets": [{ "key": "WORK_FEATURE", "countBucket": "FEW" }],
      "languageBuckets": [{ "key": "LANG_CSHARP", "countBucket": "MANY" }],
      "toolBuckets": [{ "key": "TOOL_GIT_COMMIT", "countBucket": "ONE" }]
    }
  ]
}
```

### Response Shape

```json
{
  "success": true,
  "acceptedCount": 1,
  "rejectedCount": 0,
  "results": [
    {
      "clientSessionId": "unity-git-20260514-001",
      "status": "accepted",
      "serverSessionId": "11111111-1111-4111-8111-111111111111"
    }
  ],
  "serverTime": "2026-05-14T00:00:00.000Z",
  "schemaVersion": 1
}
```

### Supported Values

`schemaVersion` is currently `1` only.

`sourceProvider` values:

- `MANUAL`
- `GIT`
- `CLAUDE`
- `CODEX`
- `UNKNOWN_AGENT`

`confidence` values:

- `LOW`
- `MEDIUM`
- `HIGH`

Count buckets:

- `NONE`
- `ONE`
- `FEW`
- `MANY`
- `MASSIVE`

Warning ids and category/tool/language bucket keys must match `^[A-Z][A-Z0-9_:-]{0,63}$`.

### Mixed Request Behavior

The service can return per-session accepted/rejected statuses for sessions that reach the service-level safe validator. The public API currently uses Nest DTO validation first, so malformed enum or bucket values reject the whole request before persistence. The mixed fixture documents and tests this current whole-request behavior.

### Database Tables

- `ActivitySession`
- `ActivitySessionWarning`
- `ActivitySessionCategoryBucket`
- `ActivitySessionLanguageBucket`
- `ActivitySessionToolBucket`

There are no database columns for raw paths, filenames, repository names, branch names, prompts, responses, commands, raw logs, source snippets, usernames, tokens, secrets, raw Git output, or approved locations.

### Privacy Boundary

The server accepts only already-sanitized aggregate data. The Unity client keeps `tokenforge-approved-locations.local.json` local-only; approved-location settings are never synced.

Forbidden field names are machine-checked against `PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES` and documented in `Docs/openapi/safe-sync.openapi.yaml` under `x-tokenforge-privacy-boundary.forbiddenFields`. The list includes raw prompt/response/log/code/path/Git/command/token/secret fields and approved-location variants. Safe aggregate names such as `sourceProvider`, `tokenBucket`, and bucket `key` values are allowed by DTO validation.

Forbidden value patterns include absolute filesystem paths, home directory paths, path-like filenames, shell commands, token-like strings, private key blocks, and source-code-like snippets.

Logs may include request id, accepted count, rejected count, safe error codes, provider enum, schema version, and duration. Logs must not include full payloads or rejected raw values.

### Tests

Fast validation:

```bash
npx prisma validate
npx prisma generate
npm run build
npm test
npm run lint
```

CI-compatible local commands:

```bash
npm run ci:fast
npm run ci:openapi
npm run ci:db
```

OpenAPI validation and artifact generation:

```bash
npm run openapi:validate
npm run openapi:artifact
npm run client-contract:validate
npm run client-contract:artifact
npm run contract:all
```

`npm run openapi:artifact` writes `artifacts/openapi/safe-sync.openapi.yaml`. `npm run client-contract:artifact` writes `artifacts/client-contract/unity-safe-sync-contract-v1.bundle.json`. GitHub Actions uploads both artifacts.

Disposable PostgreSQL e2e:

```bash
npm run test:db:e2e
```

The e2e script starts `docker-compose.test.yml`, applies Prisma migrations to `tokenforge_test`, runs only `*.e2e-spec.ts`, and stops the test container on exit. It refuses non-local or non-test `DATABASE_URL` values before starting Docker. Normal `npm test` remains mocked and fast.

### CI Jobs

`.github/workflows/ci.yml` runs on pull requests to `main`/`dev` and pushes to `main`/`dev`.

- Fast validation: Prisma validate/generate, build, Jest fast tests, lint.
- Disposable PostgreSQL e2e: Prisma generate plus Docker Compose test database e2e.
- OpenAPI contract: OpenAPI contract validation, artifact generation, artifact upload.
- Client contract: Unity bundle validation and client contract artifact upload, without requiring Unity runtime.

### Current Limitations

- `schemaVersion` 1 only.
- No conflict resolution.
- No tombstone sync.
- No background analysis.
- No raw data ingestion.
- No approved-location sync.
