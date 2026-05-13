import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PrivacyGuardService } from './privacy-guard.service';

@Module({
  controllers: [PrivacyController],
  providers: [PrivacyGuardService, PrivacyService],
  exports: [PrivacyGuardService],
})
export class PrivacyModule {}
