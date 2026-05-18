import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES } from '../src/privacy/privacy-guard.service';
import { SafeActivitySourceProviderDto } from '../src/sync/dto/activity-session-sync.dto';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const bundlePath = join(
  process.cwd(),
  'test/fixtures/client-contract-bundles/unity-safe-sync-contract-v1.bundle.json',
);
const openApiPath = join(
  process.cwd(),
  'Docs/openapi/safe-sync.openapi.yaml',
);

function readBundle() {
  return JSON.parse(readFileSync(bundlePath, 'utf8'));
}

function collectForbiddenKeys(value: unknown, found: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, found));
    return found;
  }
  if (!value || typeof value !== 'object') {
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES.some(
        (field) => field.toLowerCase() === key.toLowerCase(),
      )
    ) {
      found.push(key);
    }
    collectForbiddenKeys(child, found);
  }
  return found;
}

describe('Unity client Safe Sync contract bundle', () => {
  it('validates with the default bundle path', () => {
    const output = execFileSync(
      'npm',
      ['run', 'client-contract:validate', '--silent'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(output).toContain(
      'Client Safe Sync contract bundle validation passed.',
    );
  });

  it('validates an explicit external bundle path argument', () => {
    const output = execFileSync(
      'npm',
      [
        'run',
        'client-contract:validate',
        '--silent',
        '--',
        '--bundle',
        bundlePath,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    expect(output).toContain(
      'Client Safe Sync contract bundle validation passed.',
    );
  });

  it('matches server DTO and OpenAPI provider/schema contracts', () => {
    const bundle = readBundle();
    const openApi = YAML.parse(readFileSync(openApiPath, 'utf8')) as any;

    expect(bundle.supportedSourceProviders.sort()).toEqual(
      Object.values(SafeActivitySourceProviderDto).sort(),
    );
    expect(bundle.supportedSourceProviders.sort()).toEqual(
      openApi.components.schemas.ActivitySourceProvider.enum.sort(),
    );
    expect(bundle.supportedSchemaVersions).toEqual([
      new SafeSyncPayloadValidator().supportedSchemaVersion,
    ]);
    expect(bundle.supportedSchemaVersions).toEqual(
      openApi.components.schemas.SafeActivitySessionsUpsertRequest.properties
        .schemaVersion.enum,
    );
  });

  it('valid fixture has no forbidden keys or raw-looking values', () => {
    const bundle = readBundle();
    const validFixture = bundle.fixtures.valid;

    expect(collectForbiddenKeys(validFixture)).toEqual([]);
    expect(JSON.stringify(validFixture)).not.toMatch(
      /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    );
  });

  it('privacy expectations include every server privacy guard forbidden field', () => {
    const bundle = readBundle();
    const expected = bundle.privacyExpectations.rawFieldsNeverSynced.map(
      (field: string) => field.toLowerCase(),
    );
    for (const field of PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES) {
      expect(expected).toContain(field.toLowerCase());
    }
  });
});
