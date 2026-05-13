import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService', () => {
  it('creates guest user and stores only refresh token hash', async () => {
    const createdTokens: Array<{ tokenHash: string }> = [];
    const prisma = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: null,
          nickname: null,
          isGuest: true,
        }),
      },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) => {
          createdTokens.push({ tokenHash: data.tokenHash });
          return Promise.resolve(data);
        }),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') };
    const config = new ConfigService({
      JWT_ACCESS_SECRET: 'test-access-secret',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '30d',
    });
    const service = new AuthService(prisma as any, jwt as any, config);

    const result = await service.createGuest();

    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBeTruthy();
    expect(createdTokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdTokens[0].tokenHash).not.toBe(result.refreshToken);
  });
});
