import { Logger, NotFoundException } from '@nestjs/common';
import { SyncService } from '../src/sync/sync.service';
import { SafeSyncPayloadValidator } from '../src/sync/validators/safe-sync-payload.validator';

const now = new Date('2026-05-14T00:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    clientSessionId: 'safe-session-1',
    sourceProvider: 'GIT',
    dayBucket: '2026-05-14',
    timeBucket: null,
    confidence: 'HIGH',
    analyzerVersion: 'safe-sync.1',
    parserVersion: 'git.1',
    aggregateSchemaVersion: 1,
    hashedRepositoryId: '0123456789abcdef',
    changeCountBucket: 'FEW',
    lineCountBucket: 'MANY',
    commitCountBucket: 'ONE',
    sessionCountBucket: null,
    interactionCountBucket: null,
    activityCategory: null,
    durationBucket: null,
    warnings: [{ warningId: 'LOW_CONFIDENCE_RANGE' }],
    categoryBuckets: [{ bucketKey: 'WORK_FEATURE', countBucket: 'FEW' }],
    languageBuckets: [{ bucketKey: 'LANG_CSHARP', countBucket: 'MANY' }],
    toolBuckets: [{ bucketKey: 'TOOL_TEST', countBucket: 'ONE' }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const safeGitSession = {
  clientSessionId: 'safe-session-1',
  sourceProvider: 'GIT' as const,
  dayBucket: '2026-05-14',
  confidence: 'HIGH' as const,
  analyzerVersion: 'safe-sync.1',
  parserVersion: 'git.1',
  hashedRepositoryId: '0123456789abcdef',
  changeCountBucket: 'FEW' as const,
  lineCountBucket: 'MANY' as const,
  commitCountBucket: 'ONE' as const,
  warningIds: ['LOW_CONFIDENCE_RANGE'],
  categoryBuckets: [{ key: 'WORK_FEATURE', countBucket: 'FEW' as const }],
  languageBuckets: [{ key: 'LANG_CSHARP', countBucket: 'MANY' as const }],
};

describe('Safe Sync activity sessions', () => {
  function createService(repository: Record<string, jest.Mock>) {
    return new SyncService(
      {} as any,
      {} as any,
      {} as any,
      repository as any,
      new SafeSyncPayloadValidator(),
    );
  }

  it.each([
    ['GIT', { ...safeGitSession, sourceProvider: 'GIT' as const }],
    [
      'CLAUDE',
      {
        ...safeGitSession,
        clientSessionId: 'safe-claude-1',
        sourceProvider: 'CLAUDE' as const,
        sessionCountBucket: 'ONE' as const,
        interactionCountBucket: 'FEW' as const,
        toolBuckets: [{ key: 'TOOL_EDIT', countBucket: 'FEW' as const }],
      },
    ],
    [
      'CODEX',
      {
        ...safeGitSession,
        clientSessionId: 'safe-codex-1',
        sourceProvider: 'CODEX' as const,
        sessionCountBucket: 'ONE' as const,
        interactionCountBucket: 'MANY' as const,
      },
    ],
    [
      'UNKNOWN_AGENT',
      {
        ...safeGitSession,
        clientSessionId: 'safe-agent-1',
        sourceProvider: 'UNKNOWN_AGENT' as const,
      },
    ],
  ])('accepts a valid safe %s aggregate session', async (_provider, session) => {
    const repository = {
      upsertActivitySession: jest
        .fn()
        .mockResolvedValue(record({ clientSessionId: session.clientSessionId })),
    };
    const service = createService(repository);

    const result = await service.upsertActivitySessions('user-1', {
      schemaVersion: 1,
      sessions: [session as any],
    });

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(repository.upsertActivitySession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ clientSessionId: session.clientSessionId }),
      1,
    );
  });

  it('accepts multiple sessions and upserts idempotently by clientSessionId', async () => {
    const repository = {
      upsertActivitySession: jest
        .fn()
        .mockResolvedValueOnce(record({ clientSessionId: 'safe-session-1' }))
        .mockResolvedValueOnce(record({ clientSessionId: 'safe-session-2' }))
        .mockResolvedValueOnce(record({ clientSessionId: 'safe-session-1' })),
    };
    const service = createService(repository);

    await service.upsertActivitySessions('user-1', {
      schemaVersion: 1,
      sessions: [
        safeGitSession as any,
        { ...safeGitSession, clientSessionId: 'safe-session-2' } as any,
      ],
    });
    await service.upsertActivitySessions('user-1', {
      schemaVersion: 1,
      sessions: [safeGitSession as any],
    });

    expect(repository.upsertActivitySession).toHaveBeenCalledTimes(3);
    expect(repository.upsertActivitySession).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({ clientSessionId: 'safe-session-1' }),
      1,
    );
  });

  it('rejects unsafe sessions before persistence and does not log raw values', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const repository = {
      upsertActivitySession: jest.fn().mockResolvedValue(record()),
    };
    const service = createService(repository);

    const result = await service.upsertActivitySessions('user-1', {
      schemaVersion: 1,
      requestId: 'request-1',
      sessions: [
        safeGitSession as any,
        {
          ...safeGitSession,
          clientSessionId: 'unsafe-session-1',
          analyzerVersion: '/Users/private/repo',
        } as any,
      ],
    });

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.results[1]).toEqual({
      clientSessionId: 'unsafe-session-1',
      status: 'rejected',
      errorCode: 'UNSAFE_PATH_VALUE',
    });
    expect(repository.upsertActivitySession).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('UNSAFE_PATH_VALUE');
    expect(logged).not.toContain('/Users/private/repo');
    logSpy.mockRestore();
  });

  it('returns only safe fields for GET responses', async () => {
    const repository = {
      listActivitySessions: jest.fn().mockResolvedValue([record()]),
    };
    const service = createService(repository);

    const result = await service.listActivitySessions('user-1', {});
    const serialized = JSON.stringify(result);

    expect(serialized).toContain('safe-session-1');
    expect(serialized).toContain('hashedRepositoryId');
    expect(serialized).not.toContain('"userId"');
    expect(serialized).not.toContain('path');
    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('command');
    expect(serialized).not.toContain('rawLog');
    expect(serialized).not.toContain('repoName');
    expect(repository.listActivitySessions).toHaveBeenCalledWith('user-1', {});
  });

  it('deletes only owned safe sessions', async () => {
    const repository = {
      deleteActivitySession: jest.fn().mockResolvedValueOnce(true),
    };
    const service = createService(repository);

    await expect(
      service.deleteActivitySession(
        'user-1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        deletedId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(repository.deleteActivitySession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('returns not found when deleting a session outside the identity', async () => {
    const repository = {
      deleteActivitySession: jest.fn().mockResolvedValue(false),
    };
    const service = createService(repository);

    await expect(
      service.deleteActivitySession(
        'user-1',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
