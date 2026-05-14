import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportDataResponseDto } from './dto/export-data-response.dto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string): Promise<ExportDataResponseDto> {
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
          select: {
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
            deletedAt: true,
            stats: true,
          },
        }),
        this.prisma.sessionSummary.findMany({
          where: { userId, deletedAt: null },
          select: {
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
          },
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
