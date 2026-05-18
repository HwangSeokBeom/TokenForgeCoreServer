import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES } from '../src/privacy/privacy-guard.service';
import { SafeActivitySourceProviderDto } from '../src/sync/dto/activity-session-sync.dto';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const openApiPath = join(
  process.cwd(),
  'Docs/openapi/safe-sync.openapi.yaml',
);
const requiredEndpoints = [
  '/sync/activity-sessions',
  '/sync/activity-sessions/{id}',
  '/sync/health',
];
const forbiddenRawValuePattern =
  /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

function fail(message: string): never {
  throw new Error(`OpenAPI contract validation failed: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('expected object while reading OpenAPI document');
  }
  return value as Record<string, unknown>;
}

function getPath(document: Record<string, unknown>, segments: string[]) {
  let current: unknown = document;
  for (const segment of segments) {
    current = asRecord(current)[segment];
  }
  return current;
}

function sortedStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail('expected string array');
  }
  return [...value].sort();
}

function sortedStringifiedValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    fail('expected array');
  }
  return value.map((item) => String(item)).sort();
}

function collectExamples(value: unknown, examples: unknown[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectExamples(item, examples));
    return examples;
  }

  if (!value || typeof value !== 'object') {
    return examples;
  }

  const record = value as Record<string, unknown>;
  if ('example' in record) {
    examples.push(record.example);
  }
  if ('examples' in record) {
    const exampleMap = asRecord(record.examples);
    for (const item of Object.values(exampleMap)) {
      if (item && typeof item === 'object' && 'value' in item) {
        examples.push((item as { value: unknown }).value);
      }
    }
  }

  for (const child of Object.values(record)) {
    collectExamples(child, examples);
  }
  return examples;
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
    if (PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES.includes(key as never)) {
      found.push(key);
    }
    collectForbiddenKeys(child, found);
  }
  return found;
}

const raw = readFileSync(openApiPath, 'utf8');
const document = asRecord(YAML.parse(raw));
const paths = asRecord(document.paths);

for (const endpoint of requiredEndpoints) {
  if (!paths[endpoint]) {
    fail(`missing endpoint ${endpoint}`);
  }
}

const sourceProviderEnum = sortedStrings(
  getPath(document, [
    'components',
    'schemas',
    'ActivitySourceProvider',
    'enum',
  ]),
);
const implementedSourceProviders = Object.values(
  SafeActivitySourceProviderDto,
).sort();
if (
  JSON.stringify(sourceProviderEnum) !==
  JSON.stringify(implementedSourceProviders)
) {
  fail('ActivitySourceProvider enum differs from DTO implementation');
}

const supportedSchemaVersions = sortedStringifiedValues(
  getPath(document, [
    'components',
    'schemas',
    'SafeActivitySessionsUpsertRequest',
    'properties',
    'schemaVersion',
    'enum',
  ]),
);
const validator = new SafeSyncPayloadValidator();
if (
  JSON.stringify(supportedSchemaVersions) !==
  JSON.stringify([String(validator.supportedSchemaVersion)])
) {
  fail('schemaVersion enum differs from SafeSyncPayloadValidator');
}

const errorCodes = sortedStrings(
  getPath(document, ['components', 'schemas', 'SafeSyncErrorCode', 'enum']),
);
for (const requiredCode of [
  'UNSAFE_FIELD_NAME',
  'UNSAFE_PATH_VALUE',
  'UNSAFE_COMMAND_VALUE',
  'UNSAFE_TOKEN_VALUE',
  'UNSAFE_SOURCE_SNIPPET',
  'PAYLOAD_TOO_LARGE',
  'UNKNOWN_SCHEMA_VERSION',
  'INVALID_BUCKET_VALUE',
  'INVALID_ENUM_VALUE',
  'VALIDATION_FAILED',
]) {
  if (!errorCodes.includes(requiredCode)) {
    fail(`missing Safe Sync error code ${requiredCode}`);
  }
}

const documentedForbidden = sortedStrings(
  getPath(document, ['x-tokenforge-privacy-boundary', 'forbiddenFields']),
).map((field) => field.toLowerCase());
const guardForbidden = [...PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES]
  .map((field) => field.toLowerCase())
  .sort();
const missingForbidden = guardForbidden.filter(
  (field) => !documentedForbidden.includes(field),
);
if (missingForbidden.length > 0) {
  fail(`OpenAPI forbidden field list is missing ${missingForbidden.join(', ')}`);
}

const examples = collectExamples(document);
for (const example of examples) {
  const forbiddenKeys = collectForbiddenKeys(example);
  if (forbiddenKeys.length > 0) {
    fail(`OpenAPI example contains forbidden keys ${forbiddenKeys.join(', ')}`);
  }
  const serialized = JSON.stringify(example);
  if (forbiddenRawValuePattern.test(serialized)) {
    fail('OpenAPI example contains raw/private-looking values');
  }
}

if (!getPath(document, ['components', 'schemas', 'SafeActivitySessionsUpsertResponse'])) {
  fail('missing upsert success response schema');
}
if (!getPath(document, ['components', 'schemas', 'SafeError'])) {
  fail('missing rejection response schema');
}

console.log('OpenAPI Safe Sync contract validation passed.');
