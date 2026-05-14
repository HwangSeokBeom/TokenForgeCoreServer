import { BadRequestException } from '@nestjs/common';
import { CharactersService } from '../src/characters/characters.service';
import {
  CharacterClassDto,
  CharacterSnapshotDto,
} from '../src/characters/dto/character-snapshot.dto';

const validSnapshot: CharacterSnapshotDto = {
  displayName: 'Core Mage',
  level: 10,
  exp: 1_000,
  class: CharacterClassDto.APPRENTICE,
  syncVersion: 1,
  stats: {
    logic: 1,
    debug: 1,
    architecture: 1,
    design: 1,
    stability: 1,
    velocity: 1,
    creativity: 1,
    efficiency: 1,
    stress: 1,
  },
  evolution: { targetClass: CharacterClassDto.DEBUGGER, progress: 25 },
  appearance: { avatarId: 'avatar_1', paletteId: 'palette_1' },
  unlockedItems: ['badge_1'],
};

describe('CharactersService', () => {
  it('accepts valid safe character stats', async () => {
    const prisma = {
      character: {
        upsert: jest.fn().mockResolvedValue({
          id: 'character-1',
          userId: 'user-1',
          ...validSnapshot,
        }),
      },
      syncState: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new CharactersService(prisma as any);

    await expect(
      service.upsertSnapshot('user-1', validSnapshot),
    ).resolves.toEqual(expect.objectContaining({ id: 'character-1' }));
  });

  it('rejects impossible stat ranges', async () => {
    const prisma = {
      character: { upsert: jest.fn() },
      syncState: { upsert: jest.fn() },
    };
    const service = new CharactersService(prisma as any);

    await expect(
      service.upsertSnapshot('user-1', {
        ...validSnapshot,
        stats: {
          ...validSnapshot.stats,
          logic: 9_999,
          debug: 9_999,
          architecture: 9_999,
          design: 9_999,
          stability: 9_999,
          velocity: 9_999,
          creativity: 9_999,
          efficiency: 9_999,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
