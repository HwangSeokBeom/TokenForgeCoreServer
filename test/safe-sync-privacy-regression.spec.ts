import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_KEYS = [
  'rawPath',
  'path',
  'filePath',
  'filename',
  'fileName',
  'repoName',
  'repositoryName',
  'branchName',
  'command',
  'prompt',
  'response',
  'rawLog',
  'source',
  'sourceText',
  'code',
  'snippet',
  'username',
  'token',
  'secret',
  'apiKey',
  'password',
  'approvedLocation',
  'approvedLocations',
  'localPath',
  'localOnlyPath',
];

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectForbiddenKeys(value: unknown, found: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, found));
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        found.push(key);
      }
      collectForbiddenKeys(child, found);
    }
  }
  return found;
}

describe('Safe Sync privacy regression fixtures and docs', () => {
  it('keeps valid and mixed Unity fixtures free of forbidden keys', () => {
    for (const fixtureName of [
      'unity-safe-syncmapper-v1.valid.json',
      'unity-safe-syncmapper-v1.mixed.json',
    ]) {
      const fixture = readJson(
        join(process.cwd(), 'test/fixtures/safe-sync', fixtureName),
      );
      expect(collectForbiddenKeys(fixture)).toEqual([]);
      expect(JSON.stringify(fixture)).not.toMatch(
        /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      );
    }
  });

  it('keeps client contract bundle valid fixture free of forbidden keys', () => {
    const bundle = readJson(
      join(
        process.cwd(),
        'test/fixtures/client-contract-bundles/unity-safe-sync-contract-v1.bundle.json',
      ),
    );

    expect(collectForbiddenKeys(bundle.fixtures.valid)).toEqual([]);
    expect(JSON.stringify(bundle.fixtures.valid)).not.toMatch(
      /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    );
  });

  it('keeps OpenAPI examples free of forbidden example keys and raw values', () => {
    const openApi = readFileSync(
      join(process.cwd(), 'Docs/openapi/safe-sync.openapi.yaml'),
      'utf8',
    );
    const forbiddenExampleKey = new RegExp(
      `^\\s{8,}(${FORBIDDEN_KEYS.join('|')}):`,
      'm',
    );

    expect(openApi).not.toMatch(forbiddenExampleKey);
    expect(openApi).not.toMatch(
      /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    );
  });

  it('keeps README JSON examples free of forbidden keys', () => {
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    const jsonBlocks = [...readme.matchAll(/```json\n([\s\S]*?)\n```/g)].map(
      (match) => match[1],
    );

    for (const block of jsonBlocks) {
      const parsed = JSON.parse(block);
      expect(collectForbiddenKeys(parsed)).toEqual([]);
    }
  });

  it('keeps generated contract artifacts privacy-safe when present', () => {
    const openApiArtifact = join(
      process.cwd(),
      'artifacts/openapi/safe-sync.openapi.yaml',
    );
    const bundleArtifact = join(
      process.cwd(),
      'artifacts/client-contract/unity-safe-sync-contract-v1.bundle.json',
    );

    if (existsSync(openApiArtifact)) {
      expect(readFileSync(openApiArtifact, 'utf8')).not.toMatch(
        /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      );
    }

    if (existsSync(bundleArtifact)) {
      const bundle = readJson(bundleArtifact);
      expect(collectForbiddenKeys(bundle.fixtures.valid)).toEqual([]);
    }
  });
});
