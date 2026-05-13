import { SetMetadata } from '@nestjs/common';

export const PRIVACY_POLICY_KEY = 'privacyPolicy';

export interface PrivacyPolicyOptions {
  allowedForbiddenFields?: string[];
}

export const PrivacyPolicy = (options: PrivacyPolicyOptions) =>
  SetMetadata(PRIVACY_POLICY_KEY, options);
