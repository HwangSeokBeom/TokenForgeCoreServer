import { BadRequestException } from '@nestjs/common';
import { SessionsService } from '../src/sessions/sessions.service';
import {
  ConfidenceBandDto,
  CountBucketDto,
  DurationBucketDto,
  ResultStatusDto,
  SessionSummaryUploadDto,
  TokenBucketDto,
  WorkTypeDto,
} from '../src/sessions/dto/session-summary.dto';

const validSummary: SessionSummaryUploadDto = {
  sessionId: 'session-duplicate',
  agentType: 'codex',
  workType: WorkTypeDto.FEATURE,
  startedAt: new Date().toISOString(),
  durationBucket: DurationBucketDto.M_15_30,
  tokenBucket: TokenBucketDto.SMALL,
  changedFileCountBucket: CountBucketDto.FEW,
  addedLineBucket: CountBucketDto.FEW,
  deletedLineBucket: CountBucketDto.ONE,
  testRunCount: 1,
  buildRunCount: 0,
  resultStatus: ResultStatusDto.SUCCESS,
  expGained: 300,
  statDeltas: { logic: 10 },
  confidence: ConfidenceBandDto.HIGH,
  projectHash: '0123456789abcdef',
};

describe('SessionsService', () => {
  it('maps duplicate sessionId to VALIDATION_FAILED', async () => {
    const prisma = {
      sessionSummary: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { expGained: 0 } }),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
      syncState: { upsert: jest.fn() },
    };
    const service = new SessionsService(prisma as any);

    await expect(service.createSummary('user-1', validSummary)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects TEST workType without stability or debug delta', async () => {
    const prisma = {
      sessionSummary: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { expGained: 0 } }),
      },
    };
    const service = new SessionsService(prisma as any);

    await expect(
      service.createSummary('user-1', {
        ...validSummary,
        sessionId: 'session-test',
        workType: WorkTypeDto.TEST,
        statDeltas: { logic: 10 },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
