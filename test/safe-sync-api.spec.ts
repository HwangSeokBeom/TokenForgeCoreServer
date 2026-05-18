import {
  BadRequestException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { StructuredLoggingInterceptor } from '../src/common/interceptors/structured-logging.interceptor';
import { PrivacyGuardInterceptor } from '../src/privacy/privacy-guard.interceptor';
import { PrivacyGuardService } from '../src/privacy/privacy-guard.service';
import { SyncController } from '../src/sync/sync.controller';
import { SyncService } from '../src/sync/sync.service';

const safeActivitySession = {
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
  categoryBuckets: [{ key: 'WORK_FEATURE', countBucket: 'FEW' }],
  languageBuckets: [{ key: 'LANG_CSHARP', countBucket: 'MANY' }],
};

describe('Safe Sync Activity Sessions API', () => {
  async function createApp() {
    const sync = {
      push: jest.fn(),
      pull: jest.fn(),
      upsertActivitySessions: jest.fn().mockResolvedValue({
        success: true,
        acceptedCount: 1,
        rejectedCount: 0,
        results: [
          {
            clientSessionId: 'safe-session-1',
            status: 'accepted',
            serverSessionId: '11111111-1111-4111-8111-111111111111',
          },
        ],
        serverTime: '2026-05-14T00:00:00.000Z',
        schemaVersion: 1,
      }),
      listActivitySessions: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            clientSessionId: 'safe-session-1',
            sourceProvider: 'GIT',
            dayBucket: '2026-05-14',
            confidence: 'HIGH',
            warningIds: [],
            hashedRepositoryId: '0123456789abcdef',
            categoryBuckets: [],
            languageBuckets: [],
            toolBuckets: [],
          },
        ],
        pagination: { limit: 50, offset: 0, count: 1 },
        serverTime: '2026-05-14T00:00:00.000Z',
        schemaVersion: 1,
      }),
      deleteActivitySession: jest.fn().mockResolvedValue({
        success: true,
        deletedId: '11111111-1111-4111-8111-111111111111',
      }),
      getActivitySyncHealth: jest.fn().mockReturnValue({
        status: 'ok',
        schemaVersion: 1,
        maxLimits: {
          sessionsPerRequest: 100,
          bucketsPerGroup: 50,
          warningsPerSession: 25,
        },
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: sync }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (req.path === '/api/v1/sync/health') {
            return true;
          }
          if (req.headers.authorization === 'Bearer test-token') {
            req.user = { sub: 'user-1', isGuest: true };
            return true;
          }
          throw new UnauthorizedException();
        },
      })
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        validationError: { target: false, value: false },
        exceptionFactory: (errors) => {
          const messages = errors.flatMap((error) =>
            Object.values(error.constraints ?? {}),
          );
          return new BadRequestException({
            errorCode: 'VALIDATION_FAILED',
            message: messages.length ? messages : ['Validation failed'],
          });
        },
      }),
    );
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new StructuredLoggingInterceptor());
    app.useGlobalInterceptors(
      new PrivacyGuardInterceptor(reflector, new PrivacyGuardService()),
    );
    await app.init();
    return { app, sync };
  }

  it('POST accepts aggregate-only safe activity sessions', async () => {
    const { app, sync } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({
        schemaVersion: 1,
        clientSyncId: 'sync-1',
        sessions: [safeActivitySession],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.acceptedCount).toBe(1);
        expect(body.results[0].serverSessionId).toBe(
          '11111111-1111-4111-8111-111111111111',
        );
      });

    expect(sync.upsertActivitySessions).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ schemaVersion: 1 }),
    );
    await app.close();
  });

  it('GET returns only safe aggregate fields', async () => {
    const { app } = await createApp();

    await request(app.getHttpServer())
      .get('/api/v1/sync/activity-sessions?sourceProvider=GIT&dayBucket=2026-05-14')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        const serialized = JSON.stringify(body);
        expect(serialized).toContain('hashedRepositoryId');
        expect(serialized).not.toContain('repoName');
        expect(serialized).not.toContain('prompt');
        expect(serialized).not.toContain('command');
        expect(serialized).not.toContain('rawLog');
      });

    await app.close();
  });

  it('DELETE verifies identity through the service layer', async () => {
    const { app, sync } = await createApp();

    await request(app.getHttpServer())
      .delete('/api/v1/sync/activity-sessions/11111111-1111-4111-8111-111111111111')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.success).toBe(true);
      });

    expect(sync.deleteActivitySession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
    await app.close();
  });

  it('health exposes schema and limits without authentication', async () => {
    const { app } = await createApp();

    await request(app.getHttpServer())
      .get('/api/v1/sync/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.schemaVersion).toBe(1);
        expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
      });

    await app.close();
  });

  it('rejects raw path fields before sync handling without logging values', async () => {
    const { app, sync } = await createApp();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({
        schemaVersion: 1,
        sessions: [
          {
            ...safeActivitySession,
            path: '/Users/me/private/repo',
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(JSON.stringify(body)).toContain('PRIVACY_GUARD_REJECTED');
        expect(JSON.stringify(body)).not.toContain('/Users/me/private/repo');
      });

    expect(sync.upsertActivitySessions).not.toHaveBeenCalled();
    expect(consoleSpy.mock.calls.flat().join('\n')).not.toContain(
      '/Users/me/private/repo',
    );
    consoleSpy.mockRestore();
    await app.close();
  });

  it('rejects unknown enum values before persistence', async () => {
    const { app, sync } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({
        schemaVersion: 1,
        sessions: [
          {
            ...safeActivitySession,
            sourceProvider: 'PRIVATE_AGENT',
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(JSON.stringify(body)).toContain('VALIDATION_FAILED');
      });

    expect(sync.upsertActivitySessions).not.toHaveBeenCalled();
    await app.close();
  });
});
