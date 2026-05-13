import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AchievementsModule } from './achievements/achievements.module';
import { AuthModule } from './auth/auth.module';
import { StructuredLoggingInterceptor } from './common/interceptors/structured-logging.interceptor';
import { CharactersModule } from './characters/characters.module';
import { HealthModule } from './health/health.module';
import { PrivacyGuardInterceptor } from './privacy/privacy-guard.interceptor';
import { PrivacyModule } from './privacy/privacy.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionsModule } from './sessions/sessions.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    PrivacyModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CharactersModule,
    SessionsModule,
    SyncModule,
    AchievementsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StructuredLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PrivacyGuardInterceptor,
    },
  ],
})
export class AppModule {}
