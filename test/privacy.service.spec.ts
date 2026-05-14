import { PrivacyService } from '../src/privacy/privacy.service';

const forbiddenFieldNames = [
  'prompt',
  'rawPrompt',
  'code',
  'rawCode',
  'sourceCode',
  'log',
  'rawLog',
  'terminalOutput',
  'stdout',
  'stderr',
  'absolutePath',
  'filePath',
  'pathRaw',
  'remoteUrl',
  'gitRemote',
  'branchName',
  'rawBranchName',
  'commitMessage',
  'rawCommitMessage',
  'diff',
  'patch',
  'command',
  'commandText',
  'apiKey',
  'secret',
  'passwordRaw',
  'tokenRaw',
];

describe('PrivacyService', () => {
  it('exports safe data without forbidden field names', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: null,
          nickname: 'tester',
          settings: null,
          isGuest: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      character: { findUnique: jest.fn().mockResolvedValue(null) },
      sessionSummary: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ua-1',
            achievementId: 'achievement-1',
            unlockedAt: new Date('2026-01-01T00:00:00.000Z'),
            progress: null,
            source: 'server',
            achievement: {
              code: 'FIRST_SYNC',
              title: 'First Sync',
              description: 'Synced once',
            },
          },
        ]),
      },
      syncState: { findMany: jest.fn().mockResolvedValue([]) },
      device: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PrivacyService(prisma as any);

    const exported = await service.exportUserData('user-1');
    const serialized = JSON.stringify(exported);

    for (const fieldName of forbiddenFieldNames) {
      expect(serialized).not.toMatch(
        new RegExp(`"${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'),
      );
    }
    expect(serialized).toContain('achievementCode');
  });
});
