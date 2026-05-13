import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
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
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: 'VALIDATION_FAILED',
        message: ['User not found'],
      });
    }
    return user;
  }

  updateMe(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        settings: true,
        isGuest: true,
        updatedAt: true,
      },
    });
  }
}
