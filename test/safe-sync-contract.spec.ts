import {
  BadRequestException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { StructuredLoggingInterceptor } from '../src/common/interceptors/structured-logging.interceptor';
import { PrivacyGuardInterceptor } from '../src/privacy/privacy-guard.interceptor';
import { PrivacyGuardService } from '../src/privacy/privacy-guard.service';
import { SyncController } from '../src/sync/sync.controller';
import { SyncRepository } from '../src/sync/sync.repository';
import { SyncService } from '../src/sync/sync.service';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const FIXTURE_DIR = join(process.cwd(), 'test/fixtures/safe-sync');
const FORBIDDEN_KEYS = [
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
  'localPath',
  'localOnlyPath',
];

function loadFixture(name: string) {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), 'utf8'),
  ) as Record<string, any>;
}

function collectForbiddenKeys(value: unknown, found: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectForbiddenKeys(item, found));
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        found.push(key);
      }
      collectForbiddenKeys(child, found);
    }
  }
  return found;
}

class InMemoryActivitySessionRepository {
  private records = new Map<string, any>();

  async upsertActivitySession(userId: string, session: any, schemaVersion: number) {
    const existing = [...this.records.values()].find(
      (record) =>
        record.userId === userId &&
        record.clientSessionId === session.clientSessionId,
    );
    const id =
      existing?.id ??
      `11111111-1111-4111-8111-${String(this.records.size + 1).padStart(
        12,
        '0',
      )}`;
    const now = new Date('2026-05-14T00:00:00.000Z');
    const record = {
      id,
      userId,
      clientSessionId: session.clientSessionId,
      sourceProvider: session.sourceProvider,
      dayBucket: session.dayBucket,
      timeBucket: session.timeBucket ?? null,
      confidence: session.confidence,
      analyzerVersion: session.analyzerVersion ?? null,
      parserVersion: session.parserVersion ?? null,
      aggregateSchemaVersion: schemaVersion,
      hashedRepositoryId: session.hashedRepositoryId ?? null,
      changeCountBucket: session.changeCountBucket ?? null,
      lineCountBucket: session.lineCountBucket ?? null,
      commitCountBucket: session.commitCountBucket ?? null,
      sessionCountBucket: session.sessionCountBucket ?? null,
      interactionCountBucket: session.interactionCountBucket ?? null,
      activityCategory: session.activityCategory ?? null,
      durationBucket: session.durationBucket ?? null,
      warnings: (session.warningIds ?? []).map((warningId: string) => ({
        warningId,
      })),
      categoryBuckets: (session.categoryBuckets ?? []).map((bucket: any) => ({
        bucketKey: bucket.key,
        countBucket: bucket.countBucket,
      })),
      languageBuckets: (session.languageBuckets ?? []).map((bucket: any) => ({
        bucketKey: bucket.key,
        countBucket: bucket.countBucket,
      })),
      toolBuckets: (session.toolBuckets ?? []).map((bucket: any) => ({
        bucketKey: bucket.key,
        countBucket: bucket.countBucket,
      })),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(id, record);
    return record;
  }

  async listActivitySessions(userId: string) {
    return [...this.records.values()].filter(
      (record) => record.userId === userId,
    );
  }

  async deleteActivitySession(userId: string, id: string) {
    const existing = this.records.get(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.records.delete(id);
    return true;
  }

  count() {
    return this.records.size;
  }
}

describe('Unity SafeSyncMapper contract fixtures', () => {
  async function createApp() {
    const repository = new InMemoryActivitySessionRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        SafeSyncPayloadValidator,
        {
          provide: SyncRepository,
          useValue: repository,
        },
        {
          provide: SyncService,
          useFactory: (
            repo: SyncRepository,
            validator: SafeSyncPayloadValidator,
          ) => new SyncService({} as any, {} as any, {} as any, repo, validator),
          inject: [SyncRepository, SafeSyncPayloadValidator],
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (req.path === '/api/v1/sync/health') {
            return true;
          }
          if (req.headers.authorization === 'Bearer test-token') {
            req.user = { sub: 'user-contract', isGuest: true };
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
    return { app, repository };
  }

  it('valid Unity fixture is aggregate-only and accepted idempotently', async () => {
    const fixture = loadFixture('unity-safe-syncmapper-v1.valid.json');
    expect(collectForbiddenKeys(fixture)).toEqual([]);
    const { app, repository } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send(fixture)
      .expect(201)
      .expect(({ body }) => {
        expect(body.acceptedCount).toBe(fixture.sessions.length);
        expect(body.rejectedCount).toBe(0);
      });

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send(fixture)
      .expect(201);

    expect(repository.count()).toBe(fixture.sessions.length);

    let firstId = '';
    await request(app.getHttpServer())
      .get('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect(({ body }) => {
        const serialized = JSON.stringify(body);
        expect(collectForbiddenKeys(body)).toEqual([]);
        expect(serialized).toContain('warningIds');
        expect(serialized).toContain('categoryBuckets');
        expect(serialized).toContain('languageBuckets');
        expect(serialized).toContain('toolBuckets');
        expect(body.sessions).toHaveLength(fixture.sessions.length);
        firstId = body.sessions[0].id;
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/sync/activity-sessions/${firstId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(repository.count()).toBe(fixture.sessions.length - 1);

    await app.close();
  });

  it('mixed Unity fixture is rejected as a whole request by DTO validation', async () => {
    const fixture = loadFixture('unity-safe-syncmapper-v1.mixed.json');
    expect(collectForbiddenKeys(fixture)).toEqual([]);
    const { app, repository } = await createApp();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send(fixture)
      .expect(400)
      .expect(({ body }) => {
        expect(JSON.stringify(body)).toContain('VALIDATION_FAILED');
        expect(collectForbiddenKeys(body)).toEqual([]);
      });

    expect(repository.count()).toBe(0);
    await app.close();
  });

  it('unsafe Unity fixture is rejected before persistence without logging raw values', async () => {
    const fixture = loadFixture('unity-safe-syncmapper-v1.unsafe.json');
    const { app, repository } = await createApp();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', 'Bearer test-token')
      .send(fixture)
      .expect(400)
      .expect(({ body }) => {
        const serialized = JSON.stringify(body);
        expect(serialized).toContain('PRIVACY_GUARD_REJECTED');
        expect(serialized).not.toContain('/Users/developer/private-project');
        expect(serialized).not.toContain('CustomerSecret.cs');
        expect(serialized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
      });

    const logged = consoleSpy.mock.calls.flat().join('\n');
    expect(logged).not.toContain('/Users/developer/private-project');
    expect(logged).not.toContain('CustomerSecret.cs');
    expect(logged).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
    expect(repository.count()).toBe(0);
    consoleSpy.mockRestore();
    await app.close();
  });
});
