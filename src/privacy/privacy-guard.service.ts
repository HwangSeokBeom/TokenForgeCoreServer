import { Injectable } from '@nestjs/common';
import { ForbiddenPayloadException } from './forbidden-payload.exception';
import { PrivacyPolicyOptions } from './privacy-policy.decorator';

const FORBIDDEN_KEYS = new Set(
  [
    'prompt',
    'rawPrompt',
    'code',
    'rawCode',
    'log',
    'rawLog',
    'terminalOutput',
    'stdout',
    'stderr',
    'diff',
    'patch',
    'filePath',
    'absolutePath',
    'gitRemoteUrl',
    'branchNameRaw',
    'commitMessageRaw',
    'apiKey',
    'secret',
    'password',
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

const GLOBALLY_ALLOWED_KEYS = new Set(['tokenbucket', 'tokenrange']);

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
    const violations: string[] = [];
    this.scan(payload, '$', allowed, violations);

    if (violations.length > 0) {
      throw new ForbiddenPayloadException(violations);
    }
  }

  private scan(
    value: unknown,
    path: string,
    allowed: Set<string>,
    violations: string[],
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
          violations.push(childPath);
          continue;
        }

        this.scan(child, childPath, allowed, violations);
      }
      return;
    }

    if (
      typeof value === 'string' &&
      /^\s*bearer\s+[a-z0-9._~+/-]+=*\s*$/i.test(value)
    ) {
      violations.push(path);
    }
  }
}
