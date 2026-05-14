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
  it('upserts duplicate sessionId for idempotent uploads', async () => {
    const prisma = {
      sessionSummary: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { expGained: 0 } }),
        upsert: jest.fn().mockResolvedValue({
          id: 'summary-1',
          userId: 'user-1',
          sessionId: validSummary.sessionId,
        }),
      },
      syncState: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new SessionsService(prisma as any);

    await expect(service.createSummary('user-1', validSummary)).resolves.toEqual(
      expect.objectContaining({
        id: 'summary-1',
        sessionId: validSummary.sessionId,
      }),
    );
    expect(prisma.sessionSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_sessionId: {
            userId: 'user-1',
            sessionId: validSummary.sessionId,
          },
        },
      }),
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

  it('lists only the requesting user non-deleted summaries', async () => {
    const prisma = {
      sessionSummary: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new SessionsService(prisma as any);

    await service.listSummaries('user-1');

    expect(prisma.sessionSummary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', deletedAt: null },
      }),
    );
  });

  it('soft-deletes only the requesting user summary', async () => {
    const prisma = {
      sessionSummary: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new SessionsService(prisma as any);

    await service.deleteSummary(
      'user-1',
      '8e028ebc-8af9-4d0d-bb88-44dfd97b6ec8',
    );

    expect(prisma.sessionSummary.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '8e028ebc-8af9-4d0d-bb88-44dfd97b6ec8',
          userId: 'user-1',
          deletedAt: null,
        },
      }),
    );
  });
});
