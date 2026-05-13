import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CountBucketDto,
  ResultStatusDto,
  SessionSummaryUploadDto,
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

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSummary(userId: string, dto: SessionSummaryUploadDto) {
    await this.validateSummary(userId, dto);

    try {
      const summary = await this.prisma.sessionSummary.create({
        data: {
          sessionId: dto.sessionId,
          userId,
          agentType: dto.agentType,
          workType: dto.workType,
          startedAt: new Date(dto.startedAt),
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
          durationBucket: dto.durationBucket,
          tokenBucket: dto.tokenBucket,
          tokenRange: dto.tokenRange as Prisma.InputJsonValue | undefined,
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
          projectAlias: dto.projectAlias,
          workTypeDistribution: dto.workTypeDistribution
            ? { create: { distribution: dto.workTypeDistribution } }
            : undefined,
        },
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
        },
        update: { deletedAt: null },
      });

      return summary;
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002') ||
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002')
      ) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_FAILED',
          message: ['sessionId already exists for this user'],
        });
      }
      throw error;
    }
  }

  listSummaries(userId: string) {
    return this.prisma.sessionSummary.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }

  deleteSummary(userId: string, id: string) {
    return this.prisma.sessionSummary.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  private async validateSummary(userId: string, dto: SessionSummaryUploadDto) {
    if (!dto.tokenBucket && !dto.tokenRange) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Either tokenBucket or tokenRange is required'],
      });
    }

    if (!dto.projectHash && !dto.localOnlyProjectId) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Either projectHash or localOnlyProjectId is required'],
      });
    }

    if (dto.tokenRange && dto.tokenRange.min > dto.tokenRange.max) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['tokenRange min must not exceed max'],
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

  private maxAllowedExp(dto: SessionSummaryUploadDto): number {
    const tokenCap = dto.tokenBucket
      ? TOKEN_EXP_CAP[dto.tokenBucket]
      : Math.min(Math.ceil((dto.tokenRange?.max ?? 0) / 10), 3_000);
    const fileCap = COUNT_BONUS_CAP[dto.changedFileCountBucket];
    const resultMultiplier =
      dto.resultStatus === ResultStatusDto.SUCCESS
        ? 1
        : dto.resultStatus === ResultStatusDto.PARTIAL
          ? 0.8
          : 0.5;
    return Math.floor((tokenCap + fileCap + 300) * resultMultiplier);
  }

  private validateWorkTypeStatDeltas(dto: SessionSummaryUploadDto) {
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
