import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SyncRepository } from './sync.repository';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SafeSyncPayloadValidator } from './validators/safe-sync-payload.validator';

@Module({
  imports: [CharactersModule, SessionsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncRepository, SafeSyncPayloadValidator],
})
export class SyncModule {}
