import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncPullRequestDto, SyncPushRequestDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('pull')
  pull(@CurrentUser() user: RequestUser, @Query() dto: SyncPullRequestDto) {
    return this.sync.pull(user.sub, dto);
  }

  @Post('push')
  push(@CurrentUser() user: RequestUser, @Body() dto: SyncPushRequestDto) {
    return this.sync.push(user.sub, dto);
  }
}
