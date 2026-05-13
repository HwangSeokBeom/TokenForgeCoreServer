import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterSnapshotDto } from './dto/character-snapshot.dto';

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  getMe(userId: string) {
    return this.prisma.character.findUnique({
      where: { userId },
      include: { stats: true, evolutions: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async upsertSnapshot(userId: string, dto: CharacterSnapshotDto) {
    const character = await this.prisma.character.upsert({
      where: { userId },
      create: {
        userId,
        displayName: dto.displayName,
        level: dto.level,
        exp: dto.exp,
        class: dto.class,
        syncVersion: dto.syncVersion,
        stats: { create: dto.stats },
      },
      update: {
        displayName: dto.displayName,
        level: dto.level,
        exp: dto.exp,
        class: dto.class,
        syncVersion: dto.syncVersion,
        stats: {
          upsert: {
            create: dto.stats,
            update: dto.stats,
          },
        },
      },
      include: { stats: true },
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
      },
      update: { syncVersion: dto.syncVersion, deletedAt: null },
    });

    return character;
  }

  history(userId: string) {
    return this.prisma.characterEvolution.findMany({
      where: { character: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
