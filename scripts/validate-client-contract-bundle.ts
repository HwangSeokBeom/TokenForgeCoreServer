import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import YAML from 'yaml';
import { PrivacyGuardService } from '../src/privacy/privacy-guard.service';
import { PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES } from '../src/privacy/privacy-guard.service';
import {
  SafeActivitySessionsUpsertRequestDto,
  SafeActivitySourceProviderDto,
} from '../src/sync/dto/activity-session-sync.dto';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const defaultBundlePath = join(
  process.cwd(),
  'test/fixtures/client-contract-bundles/unity-safe-sync-contract-v1.bundle.json',
);
const openApiPath = join(
  process.cwd(),
  'Docs/openapi/safe-sync.openapi.yaml',
);
const rawValuePattern =
  /\/Users\/|\/home\/|[A-Za-z]:\\|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

function fail(message: string): never {
  throw new Error(`Client contract bundle validation failed: ${message}`);
}

function parseBundlePath(argv: string[]) {
  const bundleFlag = argv.indexOf('--bundle');
  if (bundleFlag >= 0) {
    const value = argv[bundleFlag + 1];
    if (!value) {
      fail('missing value after --bundle');
    }
    return resolve(value);
  }

  const positional = argv.find((arg) => !arg.startsWith('--'));
  return positional ? resolve(positional) : defaultBundlePath;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function sortedStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${label} must be a string array`);
  }
  return [...value].sort();
}

function sortedNumbers(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'number')) {
    fail(`${label} must be a number array`);
  }
  return [...value].sort((a, b) => a - b);
}

function getPath(document: Record<string, unknown>, segments: string[]) {
  let current: unknown = document;
  for (const segment of segments) {
    current = asRecord(current, segment)[segment];
  }
  return current;
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

function assertNoRawValues(value: unknown, label: string) {
  if (rawValuePattern.test(JSON.stringify(value))) {
    fail(`${label} contains raw/private-looking values`);
  }
}

async function assertDtoValid(payload: unknown, label: string) {
  const dto = plainToInstance(SafeActivitySessionsUpsertRequestDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    fail(`${label} failed Safe Sync request DTO validation`);
  }
}

async function assertDtoInvalid(payload: unknown, label: string) {
  const dto = plainToInstance(SafeActivitySessionsUpsertRequestDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length === 0) {
    fail(`${label} was expected to fail DTO validation`);
  }
}

async function main() {
  const bundlePath = parseBundlePath(process.argv.slice(2));
  if (!existsSync(bundlePath)) {
    fail('bundle file was not found');
  }

  const bundle = asRecord(
    JSON.parse(readFileSync(bundlePath, 'utf8')),
    'bundle',
  );
  const validator = new SafeSyncPayloadValidator();
  const privacyGuard = new PrivacyGuardService();
  const openApi = asRecord(
    YAML.parse(readFileSync(openApiPath, 'utf8')),
    'OpenAPI document',
  );

  if (bundle.bundleVersion !== 1) {
    fail('unsupported bundleVersion');
  }
  if (bundle.clientSchemaVersion !== validator.supportedSchemaVersion) {
    fail('clientSchemaVersion differs from server schemaVersion');
  }
  if (bundle.clientName !== 'TokenForgeUnityClient') {
    fail('clientName must be TokenForgeUnityClient');
  }
  if (typeof bundle.safeSyncMapperVersion !== 'string') {
    fail('safeSyncMapperVersion is required');
  }
  if (typeof bundle.generatedAt !== 'string') {
    fail('generatedAt is required');
  }
  assertNoRawValues(
    {
      clientName: bundle.clientName,
      generatedAt: bundle.generatedAt,
      safeSyncMapperVersion: bundle.safeSyncMapperVersion,
    },
    'bundle metadata',
  );

  const bundleProviders = sortedStrings(
    bundle.supportedSourceProviders,
    'supportedSourceProviders',
  );
  const dtoProviders = Object.values(SafeActivitySourceProviderDto).sort();
  if (JSON.stringify(bundleProviders) !== JSON.stringify(dtoProviders)) {
    fail('supportedSourceProviders differs from server DTO enum');
  }

  const openApiProviders = sortedStrings(
    getPath(openApi, [
      'components',
      'schemas',
      'ActivitySourceProvider',
      'enum',
    ]),
    'OpenAPI ActivitySourceProvider enum',
  );
  if (JSON.stringify(bundleProviders) !== JSON.stringify(openApiProviders)) {
    fail('supportedSourceProviders differs from OpenAPI enum');
  }

  const schemaVersions = sortedNumbers(
    bundle.supportedSchemaVersions,
    'supportedSchemaVersions',
  );
  if (
    JSON.stringify(schemaVersions) !==
    JSON.stringify([validator.supportedSchemaVersion])
  ) {
    fail('supportedSchemaVersions differs from server support');
  }

  const openApiSchemaVersions = sortedNumbers(
    getPath(openApi, [
      'components',
      'schemas',
      'SafeActivitySessionsUpsertRequest',
      'properties',
      'schemaVersion',
      'enum',
    ]),
    'OpenAPI schemaVersion enum',
  );
  if (JSON.stringify(schemaVersions) !== JSON.stringify(openApiSchemaVersions)) {
    fail('supportedSchemaVersions differs from OpenAPI');
  }

  const privacyExpectations = asRecord(
    bundle.privacyExpectations,
    'privacyExpectations',
  );
  if (privacyExpectations.approvedLocationsAreLocalOnly !== true) {
    fail('approvedLocationsAreLocalOnly must be true');
  }
  const expectedRawFields = sortedStrings(
    privacyExpectations.rawFieldsNeverSynced,
    'privacyExpectations.rawFieldsNeverSynced',
  ).map((field) => field.toLowerCase());
  const guardFields = [...PRIVACY_GUARD_FORBIDDEN_FIELD_NAMES]
    .map((field) => field.toLowerCase())
    .sort();
  const missingGuardFields = guardFields.filter(
    (field) => !expectedRawFields.includes(field),
  );
  if (missingGuardFields.length > 0) {
    fail(
      `privacyExpectations.rawFieldsNeverSynced is missing ${missingGuardFields.join(
        ', ',
      )}`,
    );
  }

  const openApiForbidden = sortedStrings(
    getPath(openApi, ['x-tokenforge-privacy-boundary', 'forbiddenFields']),
    'OpenAPI forbiddenFields',
  ).map((field) => field.toLowerCase());
  const missingOpenApiFields = expectedRawFields.filter(
    (field) => !openApiForbidden.includes(field),
  );
  if (missingOpenApiFields.length > 0) {
    fail(
      `OpenAPI forbiddenFields is missing bundle fields ${missingOpenApiFields.join(
        ', ',
      )}`,
    );
  }

  const fixtures = asRecord(bundle.fixtures, 'fixtures');
  const validFixture = fixtures.valid;
  const unsafeFixture = fixtures.unsafe;
  const mixedFixture = fixtures.mixed;
  await assertDtoValid(validFixture, 'fixtures.valid');
  privacyGuard.assertSafePayload(validFixture);
  const envelopeValidation = validator.validateEnvelope(validFixture);
  if (!envelopeValidation.safe) {
    fail(`fixtures.valid failed service validation: ${envelopeValidation.errorCode}`);
  }
  for (const session of asRecord(validFixture, 'fixtures.valid').sessions as unknown[]) {
    const sessionValidation = validator.validateSession(session);
    if (!sessionValidation.safe) {
      fail(`fixtures.valid session failed service validation: ${sessionValidation.errorCode}`);
    }
  }
  const validForbiddenKeys = collectForbiddenKeys(validFixture);
  if (validForbiddenKeys.length > 0) {
    fail(`fixtures.valid contains forbidden keys ${validForbiddenKeys.join(', ')}`);
  }
  assertNoRawValues(validFixture, 'fixtures.valid');

  let unsafeRejected = false;
  try {
    privacyGuard.assertSafePayload(unsafeFixture);
  } catch {
    unsafeRejected = true;
  }
  if (!unsafeRejected) {
    fail('fixtures.unsafe was expected to be rejected by PrivacyGuardService');
  }

  if (mixedFixture !== undefined) {
    if (bundle.mixedBehavior !== 'WHOLE_REQUEST_REJECTED_BY_DTO_VALIDATION') {
      fail('unsupported mixedBehavior');
    }
    await assertDtoInvalid(mixedFixture, 'fixtures.mixed');
    const mixedForbiddenKeys = collectForbiddenKeys(mixedFixture);
    if (mixedForbiddenKeys.length > 0) {
      fail(`fixtures.mixed contains forbidden keys ${mixedForbiddenKeys.join(', ')}`);
    }
    assertNoRawValues(mixedFixture, 'fixtures.mixed');
  }

  console.log('Client Safe Sync contract bundle validation passed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Bundle validation failed.');
  process.exit(1);
});
