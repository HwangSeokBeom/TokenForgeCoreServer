import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CharactersModule, SessionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
