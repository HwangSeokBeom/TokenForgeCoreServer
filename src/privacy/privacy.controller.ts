import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrivacyService } from './privacy.service';

@UseGuards(JwtAuthGuard)
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  export(@CurrentUser() user: RequestUser) {
    return this.privacy.exportUserData(user.sub);
  }

  @Delete('data')
  deleteData(@CurrentUser() user: RequestUser) {
    return this.privacy.deleteUserData(user.sub);
  }
}
