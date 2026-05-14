import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  AchievementSyncDto,
  SyncPullDto,
  SyncPushDto,
} from './dto/sync.dto';

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
  serverRevision: true,
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
  serverRevision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SessionSummarySelect;

const SYNC_ACHIEVEMENT_SELECT = {
  id: true,
  userId: true,
  achievementId: true,
  unlockedAt: true,
  progress: true,
  source: true,
  serverRevision: true,
  achievement: {
    select: {
      code: true,
      title: true,
      description: true,
    },
  },
} satisfies Prisma.UserAchievementSelect;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
    private readonly sessions: SessionsService,
  ) {}

  async pull(userId: string, dto: SyncPullDto = {}) {
    const [character, sessions, achievements, profile, syncStates] =
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
          orderBy: { unlockedAt: 'desc' },
          select: SYNC_ACHIEVEMENT_SELECT,
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            settings: true,
            updatedAt: true,
          },
        }),
        this.prisma.syncState.findMany({ where: { userId } }),
      ]);

    const safeCharacter = character ? this.toSafeCharacter(character) : null;
    const safeSessions = sessions.map((session) => this.toSafeSession(session));
    const safeAchievements = achievements.map((achievement) =>
      this.toSafeAchievement(achievement),
    );
    const serverRevision = Math.max(
      this.resolveServerRevision(syncStates),
      safeCharacter?.serverRevision ?? 1,
      ...safeSessions.map((session) => session.serverRevision),
      ...safeAchievements.map((achievement) => achievement.serverRevision),
    );

    this.logSafe('sync_pull', {
      userId,
      sessionCount: safeSessions.length,
      achievementCount: safeAchievements.length,
      serverRevision,
    });

    return {
      policy: 'additive-upsert',
      serverTime: new Date().toISOString(),
      serverRevision,
      sinceServerRevision: dto.sinceServerRevision ?? null,
      profile: {
        settings: profile?.settings ?? null,
        updatedAt: profile?.updatedAt ?? null,
      },
      character: safeCharacter,
      sessionSummaries: safeSessions,
      achievements: safeAchievements,
    };
  }

  async push(userId: string, dto: SyncPushDto) {
    this.assertNoAmbiguousAliases(dto);

    if (dto.idempotencyKey) {
      const existing = await this.prisma.syncState.findFirst({
        where: { userId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        this.logSafe('sync_push_idempotent_replay', {
          userId,
          sessionCount: 0,
          achievementCount: 0,
          serverRevision: existing.serverRevision,
        });
        return {
          status: 'already_processed',
          policy: 'additive-upsert',
          serverRevision: existing.serverRevision,
          accepted: {
            character: 0,
            sessionSummaries: 0,
            achievements: 0,
            profile: 0,
            settings: 0,
          },
          serverTime: new Date().toISOString(),
        };
      }
    }

    const characterPayload = dto.characterSnapshot ?? dto.character;
    const sessionPayloads = dto.sessionSummaries ?? dto.sessions ?? [];
    const accepted = {
      character: 0,
      sessionSummaries: 0,
      achievements: 0,
      profile: 0,
      settings: 0,
    };
    const serverRevisions: number[] = [];

    if (characterPayload) {
      const character = await this.characters.upsertSnapshot(
        userId,
        characterPayload,
      );
      accepted.character = 1;
      serverRevisions.push(character.serverRevision ?? character.syncVersion ?? 1);
    }

    for (const summary of sessionPayloads) {
      const saved = await this.sessions.createSummary(userId, summary);
      accepted.sessionSummaries += 1;
      serverRevisions.push(saved.serverRevision ?? 1);
    }

    for (const achievement of dto.achievements ?? []) {
      const saved = await this.upsertAchievement(userId, achievement);
      accepted.achievements += 1;
      serverRevisions.push(saved.serverRevision);
    }

    if (dto.userProgression || dto.settings) {
      const saved = await this.upsertProfile(userId, dto);
      if (dto.userProgression) {
        accepted.profile = 1;
      }
      if (dto.settings) {
        accepted.settings = 1;
      }
      serverRevisions.push(saved.serverRevision);
    }

    const serverRevision = Math.max(1, ...serverRevisions);
    if (dto.idempotencyKey) {
      const idempotencyState = await this.prisma.syncState.create({
        data: {
          userId,
          entityType: 'SETTINGS',
          entityId: `idempotency:${dto.idempotencyKey}`,
          syncVersion: dto.settings?.syncVersion ?? dto.clientRevision ?? 1,
          serverRevision,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      serverRevisions.push(idempotencyState.serverRevision);
    }

    this.logSafe('sync_push', {
      userId,
      sessionCount: accepted.sessionSummaries,
      achievementCount: accepted.achievements,
      serverRevision,
    });

    return {
      status: 'ok',
      policy: 'additive-upsert',
      serverRevision,
      accepted,
      serverTime: new Date().toISOString(),
    };
  }

  private async upsertAchievement(userId: string, dto: AchievementSyncDto) {
    const achievement = await this.prisma.achievement.upsert({
      where: { code: dto.achievementId },
      create: {
        code: dto.achievementId,
        title: dto.achievementId,
        description: 'Client-synced privacy-safe achievement.',
      },
      update: {},
      select: { id: true, code: true },
    });

    const progress = dto.progress as Prisma.InputJsonValue | undefined;
    const unlockedAt = dto.unlockedAt ? new Date(dto.unlockedAt) : new Date();
    const userAchievement = await this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
      create: {
        userId,
        achievementId: achievement.id,
        unlockedAt,
        progress,
        source: dto.sourceProvider,
        serverRevision: 1,
      },
      update: {
        unlockedAt,
        progress,
        source: dto.sourceProvider,
        serverRevision: { increment: 1 },
      },
      select: SYNC_ACHIEVEMENT_SELECT,
    });

    await this.prisma.syncState.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: 'ACHIEVEMENT',
          entityId: achievement.code,
        },
      },
      create: {
        userId,
        entityType: 'ACHIEVEMENT',
        entityId: achievement.code,
        syncVersion: 1,
        serverRevision: userAchievement.serverRevision,
      },
      update: {
        syncVersion: { increment: 1 },
        serverRevision: userAchievement.serverRevision,
        deletedAt: null,
      },
    });

    return userAchievement;
  }

  private async upsertProfile(userId: string, dto: SyncPushDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const currentSettings = this.isRecord(current?.settings)
      ? current.settings
      : {};
    const settings = {
      ...currentSettings,
      ...(dto.settings
        ? {
            cloudSyncOptIn: dto.settings.cloudSyncOptIn,
            allowProjectAliasSync: dto.settings.allowProjectAliasSync,
            theme: dto.settings.theme,
          }
        : {}),
      ...(dto.userProgression
        ? {
            userProgression: dto.userProgression,
          }
        : {}),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: settings as Prisma.InputJsonValue },
      select: { settings: true, updatedAt: true },
    });

    return this.prisma.syncState.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: 'SETTINGS',
          entityId: 'profile',
        },
      },
      create: {
        userId,
        entityType: 'SETTINGS',
        entityId: 'profile',
        syncVersion: dto.settings?.syncVersion ?? dto.clientRevision ?? 1,
        serverRevision: 1,
      },
      update: {
        syncVersion: dto.settings?.syncVersion ?? dto.clientRevision ?? 1,
        serverRevision: { increment: 1 },
        deletedAt: null,
      },
    });
  }

  private resolveServerRevision(
    syncStates: Array<{ syncVersion: number; serverRevision?: number }>,
  ) {
    return Math.max(
      1,
      ...syncStates.map((state) => state.serverRevision ?? state.syncVersion),
    );
  }

  private assertNoAmbiguousAliases(dto: SyncPushDto) {
    if (dto.character && dto.characterSnapshot) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Use either character or characterSnapshot, not both'],
      });
    }
    if (dto.sessions && dto.sessionSummaries) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Use either sessions or sessionSummaries, not both'],
      });
    }
  }

  private toSafeCharacter(character: Prisma.CharacterGetPayload<{
    select: typeof SYNC_CHARACTER_SELECT;
  }>) {
    return {
      displayName: character.displayName,
      level: character.level,
      exp: character.exp,
      class: character.class,
      evolution: character.evolution,
      appearance: character.appearance,
      unlockedItems: character.unlockedItems,
      syncVersion: character.syncVersion,
      serverRevision: character.serverRevision,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
      stats: character.stats
        ? {
            logic: character.stats.logic,
            debug: character.stats.debug,
            architecture: character.stats.architecture,
            design: character.stats.design,
            stability: character.stats.stability,
            velocity: character.stats.velocity,
            creativity: character.stats.creativity,
            efficiency: character.stats.efficiency,
            stress: character.stats.stress,
          }
        : null,
    };
  }

  private toSafeSession(session: Prisma.SessionSummaryGetPayload<{
    select: typeof SYNC_SESSION_SELECT;
  }>) {
    return {
      sessionId: session.sessionId,
      agentType: session.agentType,
      workType: session.workType,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationBucket: session.durationBucket,
      tokenBucket: session.tokenBucket,
      changedFileCountBucket: session.changedFileCountBucket,
      addedLineBucket: session.addedLineBucket,
      deletedLineBucket: session.deletedLineBucket,
      testRunCount: session.testRunCount,
      buildRunCount: session.buildRunCount,
      resultStatus: session.resultStatus,
      expGained: session.expGained,
      statDeltas: session.statDeltas,
      evolutionProgressDelta: session.evolutionProgressDelta,
      confidence: session.confidence,
      sourceProvider: session.sourceProvider,
      parserVersion: session.parserVersion,
      projectHash: session.projectHash,
      localOnlyProjectId: session.localOnlyProjectId,
      serverRevision: session.serverRevision,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private toSafeAchievement(achievement: Prisma.UserAchievementGetPayload<{
    select: typeof SYNC_ACHIEVEMENT_SELECT;
  }>) {
    return {
      achievementId: achievement.achievement.code,
      title: achievement.achievement.title,
      description: achievement.achievement.description,
      unlockedAt: achievement.unlockedAt,
      progress: achievement.progress,
      sourceProvider: achievement.source,
      serverRevision: achievement.serverRevision,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private logSafe(
    event: string,
    fields: {
      userId: string;
      sessionCount: number;
      achievementCount: number;
      serverRevision: number;
    },
  ) {
    this.logger.log(
      JSON.stringify({
        event,
        userId: fields.userId,
        acceptedSessionCount: fields.sessionCount,
        acceptedAchievementCount: fields.achievementCount,
        serverRevision: fields.serverRevision,
      }),
    );
  }
}
