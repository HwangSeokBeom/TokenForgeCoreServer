import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const requestId = request.headers['x-request-id'] ?? randomUUID();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, requestId, startedAt),
        error: () => this.log(request, response, requestId, startedAt),
      }),
    );
  }

  private log(
    request: { method: string; originalUrl?: string; url?: string; ip?: string },
    response: Response,
    requestId: unknown,
    startedAt: number,
  ) {
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ip: request.ip,
      }),
    );
  }
}
