import { PrivacyGuardService } from '../src/privacy/privacy-guard.service';
import { ForbiddenPayloadException } from '../src/privacy/forbidden-payload.exception';

describe('PrivacyGuardService', () => {
  const service = new PrivacyGuardService();

  it('rejects forbidden top-level payload fields', () => {
    expect(() =>
      service.assertSafePayload({ rawPrompt: 'do not echo this value' }),
    ).toThrow(ForbiddenPayloadException);
  });

  it('rejects nested forbidden fields in arrays', () => {
    expect(() =>
      service.assertSafePayload({
        summaries: [{ safe: true }, { metadata: { diff: 'secret-diff' } }],
      }),
    ).toThrow(ForbiddenPayloadException);
  });

  it('rejects raw token fields but allows safe token bucket fields', () => {
    expect(() =>
      service.assertSafePayload({ rawToken: 'secret-token' }),
    ).toThrow(ForbiddenPayloadException);
    expect(() =>
      service.assertSafePayload({ tokenBucket: 'SMALL', tokenRange: { min: 1, max: 10 } }),
    ).not.toThrow();
  });

  it('allows refreshToken only for explicit auth policy', () => {
    expect(() =>
      service.assertSafePayload({ refreshToken: 'opaque-refresh-token' }),
    ).toThrow(ForbiddenPayloadException);
    expect(() =>
      service.assertSafePayload(
        { refreshToken: 'opaque-refresh-token' },
        { allowedForbiddenFields: ['refreshToken'] },
      ),
    ).not.toThrow();
    expect(() =>
      service.assertSafePayload(
        { accessToken: 'opaque-access-token' },
        { allowedForbiddenFields: ['refreshToken'] },
      ),
    ).toThrow(ForbiddenPayloadException);
  });

  it('does not expose forbidden payload values in error response', () => {
    try {
      service.assertSafePayload({ nested: { code: 'super-secret-code' } });
      fail('expected forbidden payload');
    } catch (error) {
      const response = (error as ForbiddenPayloadException).getResponse();
      expect(JSON.stringify(response)).not.toContain('super-secret-code');
      expect(JSON.stringify(response)).toContain('$.nested.code');
    }
  });
});
