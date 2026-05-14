import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterSnapshotDto } from './dto/character-snapshot.dto';

const CHARACTER_SELECT = {
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
  deletedAt: true,
  stats: true,
} satisfies Prisma.CharacterSelect;

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  getMe(userId: string) {
    return this.prisma.character.findFirst({
      where: { userId, deletedAt: null },
      select: CHARACTER_SELECT,
    });
  }

  async upsertSnapshot(userId: string, dto: CharacterSnapshotDto) {
    this.validateSnapshot(dto);

    const character = await this.prisma.character.upsert({
      where: { userId },
      create: {
        userId,
        displayName: dto.displayName,
        level: dto.level,
        exp: dto.exp,
        class: dto.class,
        evolution: dto.evolution as Prisma.InputJsonValue | undefined,
        appearance: dto.appearance as Prisma.InputJsonValue | undefined,
        unlockedItems: dto.unlockedItems as Prisma.InputJsonValue | undefined,
        syncVersion: dto.syncVersion,
        serverRevision: 1,
        stats: { create: dto.stats },
      },
      update: {
        displayName: dto.displayName,
        level: dto.level,
        exp: dto.exp,
        class: dto.class,
        evolution: dto.evolution as Prisma.InputJsonValue | undefined,
        appearance: dto.appearance as Prisma.InputJsonValue | undefined,
        unlockedItems: dto.unlockedItems as Prisma.InputJsonValue | undefined,
        syncVersion: dto.syncVersion,
        serverRevision: { increment: 1 },
        deletedAt: null,
        stats: {
          upsert: {
            create: dto.stats,
            update: dto.stats,
          },
        },
      },
      select: CHARACTER_SELECT,
    });

    await this.prisma.syncState.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: 'CHARACTER',
          entityId: character.id,
        },
      },
      create: {
        userId,
        entityType: 'CHARACTER',
        entityId: character.id,
        syncVersion: dto.syncVersion,
        serverRevision: character.serverRevision,
      },
      update: {
        syncVersion: dto.syncVersion,
        serverRevision: character.serverRevision,
        deletedAt: null,
      },
    });

    return character;
  }

  history(userId: string) {
    return this.prisma.sessionSummary.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        sessionId: true,
        agentType: true,
        workType: true,
        startedAt: true,
        endedAt: true,
        durationBucket: true,
        tokenBucket: true,
        resultStatus: true,
        expGained: true,
        statDeltas: true,
        evolutionProgressDelta: true,
        confidence: true,
        sourceProvider: true,
        parserVersion: true,
      },
    });
  }

  private validateSnapshot(dto: CharacterSnapshotDto) {
    const totalStats = Object.values(dto.stats).reduce(
      (sum, value) => sum + value,
      0,
    );
    if (totalStats > 75_000) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['character stats exceed safe aggregate bounds'],
      });
    }

    if (dto.exp > dto.level * 100_000) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['character exp is inconsistent with level bounds'],
      });
    }
  }
}
