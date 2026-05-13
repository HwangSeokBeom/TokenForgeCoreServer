import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let db: 'ok' | 'unavailable' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'unavailable';
    }

    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.1.0',
      db,
    };
  }
}
