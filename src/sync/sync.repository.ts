import { Injectable } from '@nestjs/common';
import { CountBucket, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SafeActivitySessionDto,
  SafeActivitySessionsQueryDto,
} from './dto/activity-session-sync.dto';

const ACTIVITY_SESSION_SELECT = {
  id: true,
  clientSessionId: true,
  sourceProvider: true,
  dayBucket: true,
  timeBucket: true,
  confidence: true,
  analyzerVersion: true,
  parserVersion: true,
  aggregateSchemaVersion: true,
  hashedRepositoryId: true,
  changeCountBucket: true,
  lineCountBucket: true,
  commitCountBucket: true,
  sessionCountBucket: true,
  interactionCountBucket: true,
  activityCategory: true,
  durationBucket: true,
  createdAt: true,
  updatedAt: true,
  warnings: {
    select: {
      warningId: true,
    },
    orderBy: {
      warningId: 'asc',
    },
  },
  categoryBuckets: {
    select: {
      bucketKey: true,
      countBucket: true,
    },
    orderBy: {
      bucketKey: 'asc',
    },
  },
  languageBuckets: {
    select: {
      bucketKey: true,
      countBucket: true,
    },
    orderBy: {
      bucketKey: 'asc',
    },
  },
  toolBuckets: {
    select: {
      bucketKey: true,
      countBucket: true,
    },
    orderBy: {
      bucketKey: 'asc',
    },
  },
} satisfies Prisma.ActivitySessionSelect;

export type SafeActivitySessionRecord = Prisma.ActivitySessionGetPayload<{
  select: typeof ACTIVITY_SESSION_SELECT;
}>;

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertActivitySession(
    userId: string,
    session: SafeActivitySessionDto,
    schemaVersion: number,
  ): Promise<SafeActivitySessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.activitySession.upsert({
        where: {
          userId_clientSessionId: {
            userId,
            clientSessionId: session.clientSessionId,
          },
        },
        create: this.toCreateInput(userId, session, schemaVersion),
        update: this.toUpdateInput(session, schemaVersion),
        select: { id: true },
      });

      await Promise.all([
        tx.activitySessionWarning.deleteMany({
          where: { activitySessionId: saved.id },
        }),
        tx.activitySessionCategoryBucket.deleteMany({
          where: { activitySessionId: saved.id },
        }),
        tx.activitySessionLanguageBucket.deleteMany({
          where: { activitySessionId: saved.id },
        }),
        tx.activitySessionToolBucket.deleteMany({
          where: { activitySessionId: saved.id },
        }),
      ]);

      await Promise.all([
        this.createWarnings(tx, saved.id, session.warningIds),
        this.createBuckets(
          tx.activitySessionCategoryBucket,
          saved.id,
          session.categoryBuckets,
        ),
        this.createBuckets(
          tx.activitySessionLanguageBucket,
          saved.id,
          session.languageBuckets,
        ),
        this.createBuckets(
          tx.activitySessionToolBucket,
          saved.id,
          session.toolBuckets,
        ),
      ]);

      return tx.activitySession.findUniqueOrThrow({
        where: { id: saved.id },
        select: ACTIVITY_SESSION_SELECT,
      });
    });
  }

  async listActivitySessions(
    userId: string,
    query: SafeActivitySessionsQueryDto,
  ): Promise<SafeActivitySessionRecord[]> {
    return this.prisma.activitySession.findMany({
      where: {
        userId,
        ...(query.sourceProvider
          ? { sourceProvider: query.sourceProvider }
          : {}),
        ...(query.dayBucket ? { dayBucket: query.dayBucket } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dayBucket: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
      select: ACTIVITY_SESSION_SELECT,
    });
  }

  async deleteActivitySession(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.activitySession.deleteMany({
      where: { id, userId },
    });
    return result.count === 1;
  }

  private toCreateInput(
    userId: string,
    session: SafeActivitySessionDto,
    schemaVersion: number,
  ): Prisma.ActivitySessionCreateInput {
    return {
      user: { connect: { id: userId } },
      clientSessionId: session.clientSessionId,
      ...this.toWritableFields(session, schemaVersion),
    };
  }

  private toUpdateInput(
    session: SafeActivitySessionDto,
    schemaVersion: number,
  ): Prisma.ActivitySessionUpdateInput {
    return this.toWritableFields(session, schemaVersion);
  }

  private toWritableFields(
    session: SafeActivitySessionDto,
    schemaVersion: number,
  ) {
    return {
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
    };
  }

  private async createWarnings(
    tx: Prisma.TransactionClient,
    activitySessionId: string,
    warningIds: string[] | undefined,
  ) {
    if (!warningIds?.length) {
      return;
    }
    await tx.activitySessionWarning.createMany({
      data: [...new Set(warningIds)].map((warningId) => ({
        activitySessionId,
        warningId,
      })),
      skipDuplicates: true,
    });
  }

  private async createBuckets(
    delegate: {
      createMany(args: {
        data: Array<{
          activitySessionId: string;
          bucketKey: string;
          countBucket: CountBucket;
        }>;
        skipDuplicates: true;
      }): Promise<unknown>;
    },
    activitySessionId: string,
    buckets: SafeActivitySessionDto['categoryBuckets'],
  ) {
    if (!buckets?.length) {
      return;
    }
    await delegate.createMany({
      data: buckets.map((bucket) => ({
        activitySessionId,
        bucketKey: bucket.key,
        countBucket: bucket.countBucket as CountBucket,
      })),
      skipDuplicates: true,
    });
  }
}
