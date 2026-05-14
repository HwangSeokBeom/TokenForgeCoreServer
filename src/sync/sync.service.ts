import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { SyncPushDto } from './dto/sync.dto';

const SYNC_CHARACTER_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  level: true,
  exp: true,
  class: true,
  evolution: true,
  appearance: true,
  unlockedItems: true,
  syncVersion: true,
  createdAt: true,
  updatedAt: true,
  stats: true,
} satisfies Prisma.CharacterSelect;

const SYNC_SESSION_SELECT = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SessionSummarySelect;

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
    private readonly sessions: SessionsService,
  ) {}

  async pull(userId: string) {
    const [character, sessions, achievements, settings, syncStates] =
      await Promise.all([
      this.prisma.character.findFirst({
        where: { userId, deletedAt: null },
        select: SYNC_CHARACTER_SELECT,
      }),
      this.prisma.sessionSummary.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        select: SYNC_SESSION_SELECT,
      }),
      this.prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true, updatedAt: true },
      }),
      this.prisma.syncState.findMany({ where: { userId } }),
    ]);

    return {
      policy: 'last-write-wins',
      serverTime: new Date().toISOString(),
      syncVersion: this.resolveSyncVersion(syncStates),
      character,
      sessionSummaries: sessions,
      achievements: achievements.map((userAchievement) => ({
        id: userAchievement.id,
        achievementId: userAchievement.achievementId,
        achievementCode: userAchievement.achievement.code,
        title: userAchievement.achievement.title,
        description: userAchievement.achievement.description,
        unlockedAt: userAchievement.unlockedAt,
        progress: userAchievement.progress,
        source: userAchievement.source,
      })),
      settings: settings?.settings ?? null,
      syncStates,
    };
  }

  async push(userId: string, dto: SyncPushDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.syncState.findFirst({
        where: { userId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return { status: 'already_processed', idempotencyKey: dto.idempotencyKey };
      }
    }

    const results: Record<string, unknown> = {};
    if (dto.characterSnapshot) {
      results.character = await this.characters.upsertSnapshot(
        userId,
        dto.characterSnapshot,
      );
    }

    if (dto.sessionSummaries?.length) {
      results.sessionSummaries = [];
      for (const summary of dto.sessionSummaries) {
        (results.sessionSummaries as unknown[]).push(
          await this.sessions.createSummary(userId, summary),
        );
      }
    }

    if (dto.settings) {
      results.settings = await this.prisma.user.update({
        where: { id: userId },
        data: {
          settings: {
            cloudSyncOptIn: dto.settings.cloudSyncOptIn,
            allowProjectAliasSync: dto.settings.allowProjectAliasSync,
            theme: dto.settings.theme,
          },
        },
        select: { settings: true, updatedAt: true },
      });
    }

    if (dto.idempotencyKey) {
      await this.prisma.syncState.create({
        data: {
          userId,
          entityType: 'SETTINGS',
          entityId: `idempotency:${dto.idempotencyKey}`,
          syncVersion: dto.settings?.syncVersion ?? 1,
          idempotencyKey: dto.idempotencyKey,
        },
      });
    }

    return {
      status: 'ok',
      policy: 'last-write-wins',
      syncVersion: this.resolveResultSyncVersion(results),
      updatedAt: new Date().toISOString(),
      results,
    };
  }

  private resolveSyncVersion(syncStates: Array<{ syncVersion: number }>) {
    return Math.max(1, ...syncStates.map((state) => state.syncVersion));
  }

  private resolveResultSyncVersion(results: Record<string, unknown>) {
    const character = results.character as { syncVersion?: number } | undefined;
    return character?.syncVersion ?? 1;
  }
}
