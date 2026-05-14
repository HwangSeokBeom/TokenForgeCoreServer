import { BadRequestException, UnauthorizedException, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrivacyGuardInterceptor } from '../src/privacy/privacy-guard.interceptor';
import { PrivacyGuardService } from '../src/privacy/privacy-guard.service';
import { StructuredLoggingInterceptor } from '../src/common/interceptors/structured-logging.interceptor';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { SyncController } from '../src/sync/sync.controller';
import { SyncService } from '../src/sync/sync.service';

const safeSession = {
  sessionId: 'session-safe-1',
  agentType: 'codex',
  workType: 'FEATURE',
  startedAt: '2026-05-14T00:00:00.000Z',
  durationBucket: 'M_15_30',
  tokenBucket: 'SMALL',
  changedFileCountBucket: 'FEW',
  addedLineBucket: 'FEW',
  deletedLineBucket: 'ONE',
  testRunCount: 1,
  buildRunCount: 0,
  resultStatus: 'SUCCESS',
  expGained: 300,
  statDeltas: { logic: 10 },
  confidence: 'HIGH',
  sourceProvider: 'CODEX',
  projectHash: '0123456789abcdef',
};

describe('Sync API', () => {
  async function createApp() {
    const sync = {
      push: jest.fn().mockResolvedValue({
        status: 'ok',
        policy: 'additive-upsert',
        serverRevision: 3,
        accepted: {
          character: 0,
          sessionSummaries: 1,
          achievements: 1,
          profile: 0,
          settings: 0,
        },
      }),
      pull: jest.fn().mockResolvedValue({
        policy: 'additive-upsert',
        serverRevision: 3,
        character: null,
        sessionSummaries: [],
        achievements: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: sync }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          if (request.headers.authorization === 'Bearer test-token') {
            request.user = { sub: 'user-1', isGuest: true };
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

  it('push accepts a valid privacy-safe payload', async () => {
    const { app, sync } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/push')
      .set('Authorization', 'Bearer test-token')
      .send({
        idempotencyKey: 'sync-safe-1',
        sessionSummaries: [safeSession],
        achievements: [{ achievementId: 'FIRST_SAFE_SYNC' }],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.accepted.sessionSummaries).toBe(1);
        expect(body.accepted.achievements).toBe(1);
      });

    expect(sync.push).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ idempotencyKey: 'sync-safe-1' }),
    );
    await app.close();
  });

  it('rejects unknown fields before sync handling', async () => {
    const { app, sync } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/push')
      .set('Authorization', 'Bearer test-token')
      .send({ fullSaveData: { unsafe: true } })
      .expect(400)
      .expect(({ body }) => {
        expect(JSON.stringify(body)).toContain('property fullSaveData should not exist');
      });

    expect(sync.push).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects forbidden raw fields recursively without logging sensitive values', async () => {
    const { app, sync } = await createApp();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await request(app.getHttpServer())
      .post('/api/v1/sync/push')
      .set('Authorization', 'Bearer test-token')
      .send({
        sessionSummaries: [
          {
            ...safeSession,
            rawPrompt: 'private prompt should not appear in logs',
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        const serialized = JSON.stringify(body);
        expect(serialized).toContain('PRIVACY_GUARD_REJECTED');
        expect(serialized).not.toContain('private prompt should not appear');
      });

    const logged = consoleSpy.mock.calls.flat().join('\n');
    expect(logged).not.toContain('test-token');
    expect(logged).not.toContain('private prompt should not appear');
    consoleSpy.mockRestore();
    expect(sync.push).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects unauthenticated pull requests', async () => {
    const { app } = await createApp();

    await request(app.getHttpServer()).get('/api/v1/sync/pull').expect(401);

    await app.close();
  });
});
