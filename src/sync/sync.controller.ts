import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncPullRequestDto, SyncPushRequestDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('pull')
  pull(@CurrentUser() user: RequestUser, @Body() _dto: SyncPullRequestDto) {
    return this.sync.pull(user.sub);
  }

  @Post('push')
  push(@CurrentUser() user: RequestUser, @Body() dto: SyncPushRequestDto) {
    return this.sync.push(user.sub, dto);
  }
}
