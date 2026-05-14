import { Logger } from '@nestjs/common';
import { SyncService } from '../src/sync/sync.service';

const now = new Date('2026-05-14T00:00:00.000Z');

describe('SyncService', () => {
  it('upserts achievements idempotently by safe achievement id', async () => {
    const prisma = {
      syncState: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ serverRevision: 4 }),
        upsert: jest.fn().mockResolvedValue({ serverRevision: 2 }),
      },
      achievement: {
        upsert: jest.fn().mockResolvedValue({
          id: 'db-achievement-1',
          code: 'FIRST_SAFE_SYNC',
        }),
      },
      userAchievement: {
        upsert: jest.fn().mockResolvedValue({
          id: 'db-user-achievement-1',
          userId: 'user-1',
          achievementId: 'db-achievement-1',
          unlockedAt: now,
          progress: null,
          source: 'UNITY_CLIENT',
          serverRevision: 2,
          achievement: {
            code: 'FIRST_SAFE_SYNC',
            title: 'FIRST_SAFE_SYNC',
            description: 'Client-synced privacy-safe achievement.',
          },
        }),
      },
    };
    const service = new SyncService(prisma as any, {} as any, {} as any);

    await service.push('user-1', {
      idempotencyKey: 'sync-achievements-1',
      achievements: [
        { achievementId: 'FIRST_SAFE_SYNC', sourceProvider: 'UNITY_CLIENT' as any },
      ],
    });

    expect(prisma.achievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'FIRST_SAFE_SYNC' },
      }),
    );
    expect(prisma.userAchievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_achievementId: {
            userId: 'user-1',
            achievementId: 'db-achievement-1',
          },
        },
      }),
    );
  });

  it('returns only additive safe pull fields without Prisma internals', async () => {
    const prisma = {
      character: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'db-character-1',
          userId: 'user-1',
          displayName: 'Core Mage',
          level: 2,
          exp: 100,
          class: 'APPRENTICE',
          evolution: null,
          appearance: null,
          unlockedItems: ['badge_1'],
          syncVersion: 1,
          serverRevision: 2,
          createdAt: now,
          updatedAt: now,
          stats: {
            id: 'db-stats-1',
            characterId: 'db-character-1',
            logic: 1,
            debug: 1,
            architecture: 1,
            design: 1,
            stability: 1,
            velocity: 1,
            creativity: 1,
            efficiency: 1,
            stress: 1,
          },
        }),
      },
      sessionSummary: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'db-session-1',
            userId: 'user-1',
            sessionId: 'safe-session-1',
            agentType: 'codex',
            workType: 'FEATURE',
            startedAt: now,
            endedAt: null,
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
            evolutionProgressDelta: null,
            confidence: 'HIGH',
            sourceProvider: 'CODEX',
            parserVersion: 'v1',
            projectHash: '0123456789abcdef',
            localOnlyProjectId: null,
            serverRevision: 3,
            createdAt: now,
            updatedAt: now,
          },
        ]),
      },
      userAchievement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'db-user-achievement-1',
            userId: 'user-1',
            achievementId: 'db-achievement-1',
            unlockedAt: now,
            progress: null,
            source: 'UNITY_CLIENT',
            serverRevision: 4,
            achievement: {
              code: 'FIRST_SAFE_SYNC',
              title: 'FIRST_SAFE_SYNC',
              description: 'Client-synced privacy-safe achievement.',
            },
          },
        ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { cloudSyncOptIn: true },
          updatedAt: now,
        }),
      },
      syncState: {
        findMany: jest.fn().mockResolvedValue([
          { syncVersion: 1, serverRevision: 4 },
        ]),
      },
    };
    const service = new SyncService(prisma as any, {} as any, {} as any);

    const result = await service.pull('user-1');
    const serialized = JSON.stringify(result);

    expect(result.policy).toBe('additive-upsert');
    expect(serialized).toContain('safe-session-1');
    expect(serialized).not.toContain('db-session-1');
    expect(serialized).not.toContain('db-character-1');
    expect(serialized).not.toContain('"userId"');
    expect(serialized).not.toMatch(/"id":/);
  });

  it('logs accepted counts without token or raw payload values', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const prisma = {
      syncState: {
        findFirst: jest.fn().mockResolvedValue({
          serverRevision: 7,
        }),
      },
    };
    const service = new SyncService(prisma as any, {} as any, {} as any);

    await service.push('user-1', { idempotencyKey: 'sync-replay-1' });

    const logged = logSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('acceptedSessionCount');
    expect(logged).not.toContain('Bearer');
    expect(logged).not.toContain('sync-replay-1');
    logSpy.mockRestore();
  });
});
