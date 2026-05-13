import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  PRIVACY_POLICY_KEY,
  PrivacyPolicyOptions,
} from './privacy-policy.decorator';
import { PrivacyGuardService } from './privacy-guard.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class PrivacyGuardInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly privacyGuard: PrivacyGuardService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    if (WRITE_METHODS.has(request.method)) {
      const policy =
        this.reflector.getAllAndOverride<PrivacyPolicyOptions>(
          PRIVACY_POLICY_KEY,
          [context.getHandler(), context.getClass()],
        ) ?? {};
      this.privacyGuard.assertSafePayload(request.body, policy);
    }

    return next.handle();
  }
}
