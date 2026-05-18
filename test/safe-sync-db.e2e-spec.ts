import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const FIXTURE_DIR = join(process.cwd(), 'test/fixtures/safe-sync');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));
}

describe('Safe Sync API disposable PostgreSQL e2e', () => {
  let app: any;
  let prisma: PrismaService;
  let accessToken = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('tokenforge_test')) {
      throw new Error(
        'Refusing to run DB e2e without a tokenforge_test DATABASE_URL.',
      );
    }

    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '30d';
    process.env.BCRYPT_SALT_ROUNDS = '4';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
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
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.activitySession.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();

    const guest = await request(app.getHttpServer())
      .post('/api/v1/auth/guest')
      .send({})
      .expect(201);
    accessToken = guest.body.accessToken;
  });

  afterAll(async () => {
    await prisma?.activitySession.deleteMany();
    await prisma?.refreshToken.deleteMany();
    await prisma?.authAccount.deleteMany();
    await prisma?.user.deleteMany();
    await app?.close();
  });

  it('persists valid Unity fixture, upserts idempotently, cascades delete, and rejects unsafe fixture', async () => {
    const validFixture = loadFixture('unity-safe-syncmapper-v1.valid.json');
    const unsafeFixture = loadFixture('unity-safe-syncmapper-v1.unsafe.json');

    const posted = await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validFixture)
      .expect(201);

    expect(posted.body.acceptedCount).toBe(validFixture.sessions.length);
    expect(posted.body.rejectedCount).toBe(0);

    await expect(prisma.activitySession.count()).resolves.toBe(
      validFixture.sessions.length,
    );
    await expect(prisma.activitySessionWarning.count()).resolves.toBeGreaterThan(
      0,
    );
    await expect(
      prisma.activitySessionCategoryBucket.count(),
    ).resolves.toBeGreaterThan(0);
    await expect(
      prisma.activitySessionLanguageBucket.count(),
    ).resolves.toBeGreaterThan(0);
    await expect(
      prisma.activitySessionToolBucket.count(),
    ).resolves.toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validFixture)
      .expect(201);
    await expect(prisma.activitySession.count()).resolves.toBe(
      validFixture.sessions.length,
    );

    const list = await request(app.getHttpServer())
      .get('/api/v1/sync/activity-sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(JSON.stringify(list.body)).not.toContain('repoName');
    expect(JSON.stringify(list.body)).not.toContain('rawLog');

    const deleteId = list.body.sessions[0].id;
    await request(app.getHttpServer())
      .delete(`/api/v1/sync/activity-sessions/${deleteId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    await expect(
      prisma.activitySessionWarning.count({
        where: { activitySessionId: deleteId },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.activitySessionCategoryBucket.count({
        where: { activitySessionId: deleteId },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.activitySessionLanguageBucket.count({
        where: { activitySessionId: deleteId },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.activitySessionToolBucket.count({
        where: { activitySessionId: deleteId },
      }),
    ).resolves.toBe(0);

    const countBeforeUnsafe = await prisma.activitySession.count();
    await request(app.getHttpServer())
      .post('/api/v1/sync/activity-sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(unsafeFixture)
      .expect(400)
      .expect(({ body }) => {
        const serialized = JSON.stringify(body);
        expect(serialized).toContain('PRIVACY_GUARD_REJECTED');
        expect(serialized).not.toContain('/Users/developer/private-project');
        expect(serialized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
      });
    await expect(prisma.activitySession.count()).resolves.toBe(
      countBeforeUnsafe,
    );
  });
});
