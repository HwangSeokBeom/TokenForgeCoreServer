import { Injectable } from '@nestjs/common';

export type SafeSyncErrorCode =
  | 'UNSAFE_FIELD_NAME'
  | 'UNSAFE_PATH_VALUE'
  | 'UNSAFE_COMMAND_VALUE'
  | 'UNSAFE_TOKEN_VALUE'
  | 'UNSAFE_SOURCE_SNIPPET'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNKNOWN_SCHEMA_VERSION'
  | 'INVALID_BUCKET_VALUE'
  | 'INVALID_ENUM_VALUE'
  | 'VALIDATION_FAILED';

export interface SafeSyncValidationResult {
  safe: boolean;
  errorCode?: SafeSyncErrorCode;
}

const FORBIDDEN_FIELD_NAMES = new Set(
  [
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
    'approvedLocationPath',
    'approvedLocationSettings',
    'localPath',
    'localOnlyPath',
    'localApprovedLocations',
  ].map((field) => field.toLowerCase()),
);

const SAFE_BUCKET_VALUES = new Set(['NONE', 'ONE', 'FEW', 'MANY', 'MASSIVE']);
const SAFE_DURATION_BUCKET_VALUES = new Set([
  'UNDER_5M',
  'M_5_15',
  'M_15_30',
  'M_30_60',
  'H_1_2',
  'H_2_PLUS',
]);
const SAFE_ENUM_KEY = /^[A-Z][A-Z0-9_:-]{0,63}$/;
const SAFE_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const SAFE_VERSION = /^[A-Za-z0-9:._-]{1,40}$/;
const SAFE_HASH = /^(hash:)?[A-Fa-f0-9]{16,128}$/;
const DAY_BUCKET = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class SafeSyncPayloadValidator {
  readonly supportedSchemaVersion = 1;
  readonly maxSessionsPerRequest = 100;
  readonly maxBucketsPerGroup = 50;
  readonly maxWarningsPerSession = 25;

  validateEnvelope(payload: unknown): SafeSyncValidationResult {
    if (!this.isRecord(payload)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }

    for (const [key, value] of Object.entries(payload)) {
      if (key === 'sessions') {
        continue;
      }
      if (FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) {
        return { safe: false, errorCode: 'UNSAFE_FIELD_NAME' };
      }
      const privacy = this.scan(value);
      if (!privacy.safe) {
        return privacy;
      }
    }

    const schemaVersion = payload.schemaVersion ?? payload.clientSchemaVersion;
    if (schemaVersion !== this.supportedSchemaVersion) {
      return { safe: false, errorCode: 'UNKNOWN_SCHEMA_VERSION' };
    }

    if (!Array.isArray(payload.sessions)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }

    if (payload.sessions.length > this.maxSessionsPerRequest) {
      return { safe: false, errorCode: 'PAYLOAD_TOO_LARGE' };
    }

    return { safe: true };
  }

  validateSession(session: unknown): SafeSyncValidationResult {
    const privacy = this.scan(session);
    if (!privacy.safe) {
      return privacy;
    }

    if (!this.isRecord(session)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }

    const requiredSafeStrings = [
      session.clientSessionId,
      session.sourceProvider,
      session.dayBucket,
      session.confidence,
    ];
    if (requiredSafeStrings.some((value) => typeof value !== 'string')) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }

    if (!SAFE_ID.test(session.clientSessionId as string)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }
    if (!DAY_BUCKET.test(session.dayBucket as string)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }

    if (!this.validateOptionalSafeId(session.timeBucket)) {
      return { safe: false, errorCode: 'INVALID_ENUM_VALUE' };
    }
    if (!this.validateOptionalVersion(session.analyzerVersion)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }
    if (!this.validateOptionalVersion(session.parserVersion)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }
    if (!this.validateOptionalHash(session.hashedRepositoryId)) {
      return { safe: false, errorCode: 'VALIDATION_FAILED' };
    }
    if (!this.validateOptionalSafeEnumKey(session.activityCategory)) {
      return { safe: false, errorCode: 'INVALID_ENUM_VALUE' };
    }

    for (const key of [
      'changeCountBucket',
      'lineCountBucket',
      'commitCountBucket',
      'sessionCountBucket',
      'interactionCountBucket',
    ]) {
      if (!this.validateOptionalBucket(session[key])) {
        return { safe: false, errorCode: 'INVALID_BUCKET_VALUE' };
      }
    }

    if (
      session.durationBucket !== undefined &&
      !SAFE_DURATION_BUCKET_VALUES.has(String(session.durationBucket))
    ) {
      return { safe: false, errorCode: 'INVALID_BUCKET_VALUE' };
    }

    if (!this.validateWarningIds(session.warningIds)) {
      return { safe: false, errorCode: 'INVALID_ENUM_VALUE' };
    }

    for (const key of ['categoryBuckets', 'languageBuckets', 'toolBuckets']) {
      if (!this.validateBucketEntries(session[key])) {
        return { safe: false, errorCode: 'INVALID_BUCKET_VALUE' };
      }
    }

    return { safe: true };
  }

  private scan(value: unknown): SafeSyncValidationResult {
    if (Array.isArray(value)) {
      if (value.length > this.maxSessionsPerRequest * 4) {
        return { safe: false, errorCode: 'PAYLOAD_TOO_LARGE' };
      }
      for (const item of value) {
        const child = this.scan(item);
        if (!child.safe) {
          return child;
        }
      }
      return { safe: true };
    }

    if (this.isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (FORBIDDEN_FIELD_NAMES.has(key.toLowerCase())) {
          return { safe: false, errorCode: 'UNSAFE_FIELD_NAME' };
        }
        const childResult = this.scan(child);
        if (!childResult.safe) {
          return childResult;
        }
      }
      return { safe: true };
    }

    if (typeof value === 'string') {
      return this.scanString(value);
    }

    return { safe: true };
  }

  private scanString(value: string): SafeSyncValidationResult {
    if (value.length > 2_000) {
      return { safe: false, errorCode: 'UNSAFE_SOURCE_SNIPPET' };
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' };
    }
    if (/^\s*bearer\s+[a-z0-9._~+/-]+=*\s*$/i.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' };
    }
    if (/sk-[A-Za-z0-9_-]{20,}/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' };
    }
    if (/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_TOKEN_VALUE' };
    }
    if (/(^|[\s"'([{])(~\/|\/Users\/|\/home\/|[A-Za-z]:\\)/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_PATH_VALUE' };
    }
    if (/(^|[\s"'([{])\.{0,2}[A-Za-z0-9_.-]+[\\/][^\s"'()]+\.[A-Za-z0-9]{1,8}\b/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_PATH_VALUE' };
    }
    if (/^\s*(git|npm|npx|pnpm|yarn|node|python3?|bash|zsh|sh|curl|ssh|scp|kubectl|docker)\s+/.test(value)) {
      return { safe: false, errorCode: 'UNSAFE_COMMAND_VALUE' };
    }
    if (this.looksLikeSourceSnippet(value)) {
      return { safe: false, errorCode: 'UNSAFE_SOURCE_SNIPPET' };
    }

    return { safe: true };
  }

  private looksLikeSourceSnippet(value: string): boolean {
    const lines = value.split(/\r?\n/);
    if (lines.length < 4) {
      return false;
    }

    const codeLines = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        /^(\+{1,3}|-{1,3}|@@\s)/.test(trimmed) ||
        /[{};]/.test(trimmed) ||
        /^(import|export|const|let|var|function|class|interface|type|if|for|while|return)\b/.test(
          trimmed,
        )
      );
    });

    return codeLines.length >= 3;
  }

  private validateWarningIds(value: unknown): boolean {
    if (value === undefined) {
      return true;
    }
    return (
      Array.isArray(value) &&
      value.length <= this.maxWarningsPerSession &&
      value.every(
        (item) => typeof item === 'string' && SAFE_ENUM_KEY.test(item),
      )
    );
  }

  private validateBucketEntries(value: unknown): boolean {
    if (value === undefined) {
      return true;
    }
    return (
      Array.isArray(value) &&
      value.length <= this.maxBucketsPerGroup &&
      value.every(
        (item) =>
          this.isRecord(item) &&
          typeof item.key === 'string' &&
          SAFE_ENUM_KEY.test(item.key) &&
          typeof item.countBucket === 'string' &&
          SAFE_BUCKET_VALUES.has(item.countBucket),
      )
    );
  }

  private validateOptionalBucket(value: unknown): boolean {
    return value === undefined || SAFE_BUCKET_VALUES.has(String(value));
  }

  private validateOptionalSafeId(value: unknown): boolean {
    return value === undefined || (typeof value === 'string' && SAFE_ID.test(value));
  }

  private validateOptionalSafeEnumKey(value: unknown): boolean {
    return (
      value === undefined ||
      (typeof value === 'string' && SAFE_ENUM_KEY.test(value))
    );
  }

  private validateOptionalVersion(value: unknown): boolean {
    return (
      value === undefined ||
      (typeof value === 'string' && SAFE_VERSION.test(value))
    );
  }

  private validateOptionalHash(value: unknown): boolean {
    return (
      value === undefined ||
      (typeof value === 'string' && SAFE_HASH.test(value))
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
