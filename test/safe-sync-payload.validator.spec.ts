import { readFileSync } from 'fs';
import { join } from 'path';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const safeSession = {
  clientSessionId: 'safe-session-1',
  sourceProvider: 'GIT',
  dayBucket: '2026-05-14',
  confidence: 'HIGH',
  analyzerVersion: 'safe-sync.1',
  parserVersion: 'git.1',
  hashedRepositoryId: '0123456789abcdef',
  changeCountBucket: 'FEW',
  lineCountBucket: 'MANY',
  commitCountBucket: 'ONE',
  warningIds: ['LOW_CONFIDENCE_RANGE'],
  categoryBuckets: [{ key: 'WORK_FEATURE', countBucket: 'FEW' }],
  languageBuckets: [{ key: 'LANG_CSHARP', countBucket: 'MANY' }],
  toolBuckets: [{ key: 'TOOL_TEST', countBucket: 'ONE' }],
};

describe('SafeSyncPayloadValidator', () => {
  const validator = new SafeSyncPayloadValidator();

  it('accepts valid aggregate-only activity sessions', () => {
    expect(
      validator.validateEnvelope({
        schemaVersion: 1,
        sessions: [safeSession],
      }),
    ).toEqual({ safe: true });
    expect(validator.validateSession(safeSession)).toEqual({ safe: true });
  });

  it.each([
    ['path', 'UNSAFE_FIELD_NAME'],
    ['fileName', 'UNSAFE_FIELD_NAME'],
    ['repoName', 'UNSAFE_FIELD_NAME'],
    ['branchName', 'UNSAFE_FIELD_NAME'],
    ['prompt', 'UNSAFE_FIELD_NAME'],
    ['response', 'UNSAFE_FIELD_NAME'],
    ['rawLog', 'UNSAFE_FIELD_NAME'],
    ['code', 'UNSAFE_FIELD_NAME'],
    ['snippet', 'UNSAFE_FIELD_NAME'],
    ['approvedLocations', 'UNSAFE_FIELD_NAME'],
  ])('rejects unsafe field name %s', (fieldName, errorCode) => {
    expect(
      validator.validateSession({
        ...safeSession,
        [fieldName]: 'private value',
      }),
    ).toEqual({ safe: false, errorCode });
  });

  it('rejects path-like values without returning the value', () => {
    expect(
      validator.validateSession({
        ...safeSession,
        analyzerVersion: '/Users/me/private/project',
      }),
    ).toEqual({ safe: false, errorCode: 'UNSAFE_PATH_VALUE' });
  });

  it('rejects command-like values', () => {
    expect(
      validator.validateSession({
        ...safeSession,
        parserVersion: 'git status --short',
      }),
    ).toEqual({ safe: false, errorCode: 'UNSAFE_COMMAND_VALUE' });
  });

  it('rejects token and private-key-like values', () => {
    expect(
      validator.validateSession({
        ...safeSession,
        analyzerVersion: 'sk-abcdefghijklmnopqrstuvwxyz123456',
      }),
    ).toEqual({ safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' });

    expect(
      validator.validateSession({
        ...safeSession,
        parserVersion: '-----BEGIN PRIVATE KEY-----\nsecret',
      }),
    ).toEqual({ safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' });
  });

  it('rejects oversized arrays and invalid bucket values', () => {
    expect(
      validator.validateEnvelope({
        schemaVersion: 1,
        sessions: Array.from({ length: 101 }, () => safeSession),
      }),
    ).toEqual({ safe: false, errorCode: 'PAYLOAD_TOO_LARGE' });

    expect(
      validator.validateSession({
        ...safeSession,
        changeCountBucket: 'PRIVATE_REPO',
      }),
    ).toEqual({ safe: false, errorCode: 'INVALID_BUCKET_VALUE' });
  });

  it('rejects unsupported schema versions', () => {
    expect(
      validator.validateEnvelope({
        schemaVersion: 2,
        sessions: [safeSession],
      }),
    ).toEqual({ safe: false, errorCode: 'UNKNOWN_SCHEMA_VERSION' });
  });

  it('keeps activity-session database models free of forbidden raw columns', () => {
    const schema = readFileSync(
      join(process.cwd(), 'prisma/schema.prisma'),
      'utf8',
    );
    const activityModelBlock = schema.slice(
      schema.indexOf('model ActivitySession'),
      schema.length,
    );

    for (const forbidden of [
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
    ]) {
      expect(activityModelBlock).not.toMatch(
        new RegExp(`\\s${forbidden}\\s`, 'i'),
      );
    }
  });
});
