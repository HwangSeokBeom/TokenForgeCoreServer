import { Injectable } from '@nestjs/common';
import { ForbiddenPayloadException } from './forbidden-payload.exception';
import { PrivacyPolicyOptions } from './privacy-policy.decorator';

const FORBIDDEN_KEYS = new Set(
  [
    'prompt',
    'rawPrompt',
    'rawDiff',
    'code',
    'rawCode',
    'sourceCode',
    'log',
    'rawLog',
    'claudeLog',
    'codexLog',
    'terminalOutput',
    'stdout',
    'stderr',
    'absolutePath',
    'filePath',
    'path',
    'pathRaw',
    'remoteUrl',
    'gitRemote',
    'gitRemoteUrl',
    'branchName',
    'rawBranchName',
    'branchNameRaw',
    'commitMessage',
    'rawCommitMessage',
    'commitMessageRaw',
    'diff',
    'patch',
    'command',
    'commandText',
    'apiKey',
    'secret',
    'passwordRaw',
    'password',
    'authorization',
    'tokenRaw',
    'rawToken',
    'refreshToken',
    'apiToken',
    'accessToken',
    'secretToken',
    'Authorization',
    'Bearer',
    'token',
  ].map((key) => key.toLowerCase()),
);

const GLOBALLY_ALLOWED_KEYS = new Set(['tokenbucket']);

const ABSOLUTE_PATH_PATTERNS = [
  /(^|[\s"'([{])\/Users\//,
  /(^|[\s"'([{])\/home\//,
  /(^|[\s"'([{])[A-Za-z]:\\/,
];

const GIT_REMOTE_PATTERNS = [
  /git@github\.com:/i,
  /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\.git\b/i,
];

interface PrivacyViolation {
  path: string;
  reason: string;
}

@Injectable()
export class PrivacyGuardService {
  assertSafePayload(
    payload: unknown,
    policy: PrivacyPolicyOptions = {},
  ): void {
    const allowed = new Set(
      [
        ...GLOBALLY_ALLOWED_KEYS,
        ...(policy.allowedForbiddenFields ?? []).map((field) =>
          field.toLowerCase(),
        ),
      ].map((field) => field.toLowerCase()),
    );
    const violations: PrivacyViolation[] = [];
    this.scan(payload, '$', allowed, violations);

    if (violations.length > 0) {
      throw new ForbiddenPayloadException(
        violations.map(
          (violation) => `${violation.reason} at ${violation.path}`,
        ),
      );
    }
  }

  private scan(
    value: unknown,
    path: string,
    allowed: Set<string>,
    violations: PrivacyViolation[],
  ) {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.scan(item, `${path}[${index}]`, allowed, violations),
      );
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const normalizedKey = key.toLowerCase();
        const childPath = `${path}.${key}`;

        if (
          FORBIDDEN_KEYS.has(normalizedKey) &&
          !allowed.has(normalizedKey)
        ) {
          violations.push({
            path: childPath,
            reason: 'forbidden_field',
          });
          continue;
        }

        this.scan(child, childPath, allowed, violations);
      }
      return;
    }

    if (typeof value === 'string') {
      this.scanString(value, path, violations);
    }
  }

  private scanString(
    value: string,
    path: string,
    violations: PrivacyViolation[],
  ) {
    if (/^\s*bearer\s+[a-z0-9._~+/-]+=*\s*$/i.test(value)) {
      violations.push({ path, reason: 'raw_token_value' });
      return;
    }

    if (ABSOLUTE_PATH_PATTERNS.some((pattern) => pattern.test(value))) {
      violations.push({ path, reason: 'absolute_path_value' });
      return;
    }

    if (GIT_REMOTE_PATTERNS.some((pattern) => pattern.test(value))) {
      violations.push({ path, reason: 'git_remote_value' });
      return;
    }

    if (this.looksLikeLargeCodeOrDiff(value)) {
      violations.push({ path, reason: 'code_or_diff_block_value' });
    }
  }

  private looksLikeLargeCodeOrDiff(value: string): boolean {
    const lines = value.split(/\r?\n/);
    if (lines.length < 4) {
      return false;
    }

    const diffLineCount = lines.filter((line) =>
      /^(\+{1,3}|-{1,3}|@@\s)/.test(line.trimStart()),
    ).length;
    if (diffLineCount >= 2) {
      return true;
    }

    const codeLineCount = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.startsWith('```') ||
        /[{};]/.test(trimmed) ||
        /^(import|export|const|let|var|function|class|interface|type|if|for|while|return)\b/.test(
          trimmed,
        )
      );
    }).length;

    return codeLineCount >= 3 || (value.length > 2_000 && codeLineCount > 0);
  }
}
