import { Injectable } from '@nestjs/common';
import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { SyncPushRequestDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
    private readonly sessions: SessionsService,
  ) {}

  async pull(userId: string) {
    const [character, sessions, settings, syncStates] = await Promise.all([
      this.prisma.character.findUnique({
        where: { userId },
        include: { stats: true },
      }),
      this.prisma.sessionSummary.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 200,
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
      character,
      sessionSummaries: sessions,
      settings: settings?.settings ?? null,
      syncStates,
    };
  }

  async push(userId: string, dto: SyncPushRequestDto) {
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
      updatedAt: new Date().toISOString(),
      results,
    };
  }
}
