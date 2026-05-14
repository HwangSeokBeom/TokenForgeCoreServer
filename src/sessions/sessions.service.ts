import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CountBucketDto,
  ResultStatusDto,
  UploadSessionSummaryDto,
  TokenBucketDto,
  WorkTypeDto,
} from './dto/session-summary.dto';

const TOKEN_EXP_CAP: Record<TokenBucketDto, number> = {
  NONE: 100,
  TINY: 250,
  SMALL: 600,
  MEDIUM: 1_200,
  LARGE: 2_000,
  HUGE: 3_000,
};

const COUNT_BONUS_CAP: Record<CountBucketDto, number> = {
  NONE: 0,
  ONE: 100,
  FEW: 250,
  MANY: 500,
  MASSIVE: 800,
};

const SESSION_SUMMARY_SELECT = {
  id: true,
  sessionId: true,
  userId: true,
  agentType: true,
  workType: true,
  startedAt: true,
  endedAt: true,
  durationBucket: true,
  tokenBucket: true,
  changedFileCountBucket: true,
  addedLineBucket: true,
  deletedLineBucket: true,
  testRunCount: true,
  buildRunCount: true,
  resultStatus: true,
  expGained: true,
  statDeltas: true,
  evolutionProgressDelta: true,
  confidence: true,
  sourceProvider: true,
  parserVersion: true,
  projectHash: true,
  localOnlyProjectId: true,
  serverRevision: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.SessionSummarySelect;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSummary(userId: string, dto: UploadSessionSummaryDto) {
    await this.validateSummary(userId, dto);

    const safeData = {
      agentType: dto.agentType,
      workType: dto.workType,
      startedAt: new Date(dto.startedAt),
      endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
      durationBucket: dto.durationBucket,
      tokenBucket: dto.tokenBucket,
      changedFileCountBucket: dto.changedFileCountBucket,
      addedLineBucket: dto.addedLineBucket,
      deletedLineBucket: dto.deletedLineBucket,
      testRunCount: dto.testRunCount,
      buildRunCount: dto.buildRunCount,
      resultStatus: dto.resultStatus,
      expGained: dto.expGained,
      statDeltas: dto.statDeltas as Prisma.InputJsonValue,
      evolutionProgressDelta:
        dto.evolutionProgressDelta as Prisma.InputJsonValue | undefined,
      confidence: dto.confidence,
      excludedFromCompetitive: dto.confidence === 'LOW',
      sourceProvider: dto.sourceProvider,
      parserVersion: dto.parserVersion,
      projectHash: dto.projectHash,
      localOnlyProjectId: dto.localOnlyProjectId,
      deletedAt: null,
    };

    const summary = await this.prisma.sessionSummary.upsert({
      where: {
        userId_sessionId: {
          userId,
          sessionId: dto.sessionId,
        },
      },
      create: {
        sessionId: dto.sessionId,
        userId,
        ...safeData,
        serverRevision: 1,
      },
      update: {
        ...safeData,
        serverRevision: { increment: 1 },
      },
      select: SESSION_SUMMARY_SELECT,
    });

    await this.prisma.syncState.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: 'SESSION_SUMMARY',
          entityId: summary.id,
        },
      },
      create: {
        userId,
        entityType: 'SESSION_SUMMARY',
        entityId: summary.id,
        syncVersion: 1,
        serverRevision: summary.serverRevision,
      },
      update: {
        syncVersion: { increment: 1 },
        serverRevision: summary.serverRevision,
        deletedAt: null,
      },
    });

    return summary;
  }

  listSummaries(userId: string) {
    return this.prisma.sessionSummary.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 200,
      select: SESSION_SUMMARY_SELECT,
    });
  }

  deleteSummary(userId: string, id: string) {
    return this.prisma.sessionSummary.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  private async validateSummary(userId: string, dto: UploadSessionSummaryDto) {
    if (!dto.tokenBucket) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['tokenBucket is required'],
      });
    }

    if (!dto.projectHash && !dto.localOnlyProjectId) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Either projectHash or localOnlyProjectId is required'],
      });
    }

    const maxExp = this.maxAllowedExp(dto);
    if (dto.expGained > maxExp) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['expGained exceeds safe server cap for this summary'],
      });
    }

    this.validateWorkTypeStatDeltas(dto);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aggregate = await this.prisma.sessionSummary.aggregate({
      where: {
        userId,
        NOT: { sessionId: dto.sessionId },
        createdAt: { gte: today },
        deletedAt: null,
      },
      _sum: { expGained: true },
    });
    const currentTotal = aggregate._sum.expGained ?? 0;
    if (currentTotal + dto.expGained > 25_000) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['daily exp soft cap exceeded'],
      });
    }
  }

  private maxAllowedExp(dto: UploadSessionSummaryDto): number {
    const tokenCap = TOKEN_EXP_CAP[dto.tokenBucket];
    const fileCap = COUNT_BONUS_CAP[dto.changedFileCountBucket];
    const resultMultiplier =
      dto.resultStatus === ResultStatusDto.SUCCESS
        ? 1
        : dto.resultStatus === ResultStatusDto.PARTIAL
          ? 0.8
          : 0.5;
    return Math.floor((tokenCap + fileCap + 300) * resultMultiplier);
  }

  private validateWorkTypeStatDeltas(dto: UploadSessionSummaryDto) {
    const totalAbs = Object.values(dto.statDeltas).reduce(
      (sum, value) => sum + Math.abs(value ?? 0),
      0,
    );
    if (totalAbs > 800) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['statDeltas total exceeds safe cap'],
      });
    }

    if (
      dto.workType === WorkTypeDto.TEST &&
      !dto.statDeltas.stability &&
      !dto.statDeltas.debug
    ) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['TEST workType must affect stability or debug'],
      });
    }

    if (
      dto.workType === WorkTypeDto.ARCHITECTURE &&
      !dto.statDeltas.architecture
    ) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['ARCHITECTURE workType must affect architecture'],
      });
    }
  }
}
