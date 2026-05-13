import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { addDays } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { createOpaqueToken, hashToken } from './token.util';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createGuest() {
    const user = await this.prisma.user.create({
      data: {
        isGuest: true,
        accounts: {
          create: {
            provider: 'GUEST',
            providerUserId: randomUUID(),
          },
        },
      },
    });

    const tokens = await this.issueTokens(user.id, undefined, true);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Email is already registered'],
      });
    }

    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        nickname: dto.nickname,
        accounts: {
          create: {
            provider: 'EMAIL',
            providerUserId: dto.email.toLowerCase(),
            passwordHash,
          },
        },
      },
    });

    const tokens = await this.issueTokens(user.id, user.email ?? undefined);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'EMAIL',
          providerUserId: dto.email.toLowerCase(),
        },
      },
      include: { user: true },
    });

    if (
      !account?.passwordHash ||
      !(await bcrypt.compare(dto.password, account.passwordHash))
    ) {
      throw new UnauthorizedException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Invalid credentials'],
      });
    }

    const tokens = await this.issueTokens(
      account.user.id,
      account.user.email ?? undefined,
      account.user.isGuest,
    );
    return { user: this.toPublicUser(account.user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const currentHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: currentHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now() ||
      stored.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException({
        errorCode: 'VALIDATION_FAILED',
        message: ['Invalid refresh token'],
      });
    }

    const nextRefreshToken = createOpaqueToken();
    const nextHash = hashToken(nextRefreshToken);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedByHash: nextHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: nextHash,
          expiresAt: addDays(new Date(), this.refreshTokenDays()),
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(
      stored.user.id,
      stored.user.email ?? undefined,
      stored.user.isGuest,
    );
    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { status: 'ok' };
  }

  async requestAccountDeletion(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'DELETION_REQUESTED', deletedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.deletedDataAudit.create({
        data: { userId, reason: 'USER_REQUESTED_ACCOUNT_DELETION' },
      }),
    ]);
    return { status: 'deletion_requested' };
  }

  private async issueTokens(
    userId: string,
    email?: string,
    isGuest?: boolean,
  ): Promise<TokenPair> {
    const refreshToken = createOpaqueToken();
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: addDays(new Date(), this.refreshTokenDays()),
      },
    });

    return {
      accessToken: await this.signAccessToken(userId, email, isGuest),
      refreshToken,
    };
  }

  private signAccessToken(userId: string, email?: string, isGuest?: boolean) {
    return this.jwt.signAsync(
      { sub: userId, email, isGuest },
      {
        secret:
          this.config.get<string>('JWT_ACCESS_SECRET') ??
          'local-dev-access-secret',
        expiresIn: this.config.get<string>('ACCESS_TOKEN_EXPIRES_IN') ?? '15m',
      },
    );
  }

  private refreshTokenDays(): number {
    const raw = this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '30d';
    const match = raw.match(/^(\d+)d$/);
    return match ? Number(match[1]) : 30;
  }

  private toPublicUser(user: {
    id: string;
    email: string | null;
    nickname: string | null;
    isGuest: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      isGuest: user.isGuest,
    };
  }
}
