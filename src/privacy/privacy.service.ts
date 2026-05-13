import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string) {
    const [user, character, sessions, achievements, syncStates, devices] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            nickname: true,
            settings: true,
            isGuest: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.character.findUnique({
          where: { userId },
          include: { stats: true, evolutions: true },
        }),
        this.prisma.sessionSummary.findMany({
          where: { userId, deletedAt: null },
          include: { workTypeDistribution: true },
        }),
        this.prisma.userAchievement.findMany({
          where: { userId },
          include: { achievement: true },
        }),
        this.prisma.syncState.findMany({ where: { userId } }),
        this.prisma.device.findMany({ where: { userId } }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      note: 'Export contains only server-stored privacy-safe aggregate data.',
      user,
      character,
      sessionSummaries: sessions,
      achievements,
      syncStates,
      devices,
    };
  }

  async deleteUserData(userId: string) {
    await this.prisma.deletedDataAudit.create({
      data: {
        userId,
        reason: 'USER_REQUESTED_DATA_DELETE',
        completedAt: new Date(),
      },
    });
    await this.prisma.user.delete({ where: { id: userId } });
    return { status: 'deleted' };
  }
}
