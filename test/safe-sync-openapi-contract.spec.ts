import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES } from '../src/privacy/privacy-guard.service';
import {
  SafeActivitySessionsUpsertRequestDto,
  SafeActivitySourceProviderDto,
} from '../src/sync/dto/activity-session-sync.dto';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const openApiPath = join(
  process.cwd(),
  'Docs/openapi/safe-sync.openapi.yaml',
);

function readOpenApi() {
  return YAML.parse(readFileSync(openApiPath, 'utf8')) as any;
}

describe('Safe Sync OpenAPI contract drift guard', () => {
  it('documents all implemented Safe Sync endpoints', () => {
    const openApi = readOpenApi();
    expect(Object.keys(openApi.paths)).toEqual(
      expect.arrayContaining([
        '/sync/activity-sessions',
        '/sync/activity-sessions/{id}',
        '/sync/health',
      ]),
    );
    expect(openApi.paths['/sync/activity-sessions'].post).toBeDefined();
    expect(openApi.paths['/sync/activity-sessions'].get).toBeDefined();
    expect(openApi.paths['/sync/activity-sessions/{id}'].delete).toBeDefined();
    expect(openApi.paths['/sync/health'].get).toBeDefined();
  });

  it('matches sourceProvider enum and supported schema version', () => {
    const openApi = readOpenApi();
    expect(
      openApi.components.schemas.ActivitySourceProvider.enum.sort(),
    ).toEqual(Object.values(SafeActivitySourceProviderDto).sort());
    expect(
      openApi.components.schemas.SafeActivitySessionsUpsertRequest.properties
        .schemaVersion.enum,
    ).toEqual([new SafeSyncPayloadValidator().supportedSchemaVersion]);
  });

  it('documents every privacy guard forbidden field', () => {
    const openApi = readOpenApi();
    const documented = openApi['x-tokenforge-privacy-boundary'].forbiddenFields
      .map((field: string) => field.toLowerCase())
      .sort();
    const implemented = [...PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES]
      .map((field) => field.toLowerCase())
      .sort();

    expect(documented).toEqual(expect.arrayContaining(implemented));
  });

  it('valid Unity fixture passes request DTO validation', async () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'test/fixtures/safe-sync/unity-safe-syncmapper-v1.valid.json',
        ),
        'utf8',
      ),
    );
    const dto = plainToInstance(SafeActivitySessionsUpsertRequestDto, fixture);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
  });

  it('DB e2e runner refuses unsafe non-test DATABASE_URL before Docker startup', () => {
    expect(() =>
      execFileSync('bash', ['scripts/run-db-e2e.sh'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://tokenforge:secret@db.example.com/tokenforge',
        },
        stdio: 'pipe',
      }),
    ).toThrow(/local test host|Command failed/);
  });

  it('package exposes CI and OpenAPI scripts', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    );
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        'openapi:validate': expect.any(String),
        'openapi:artifact': expect.any(String),
        'client-contract:validate': expect.any(String),
        'client-contract:artifact': expect.any(String),
        'ci:fast': expect.any(String),
        'ci:db': expect.any(String),
        'ci:openapi': expect.any(String),
        'ci:contract': expect.any(String),
      }),
    );
  });
});
