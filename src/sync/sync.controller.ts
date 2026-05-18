import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import {
  SafeActivitySessionsQueryDto,
  SafeActivitySessionsUpsertRequestDto,
} from './dto/activity-session-sync.dto';
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

  @Post('activity-sessions')
  upsertActivitySessions(
    @CurrentUser() user: RequestUser,
    @Body() dto: SafeActivitySessionsUpsertRequestDto,
  ) {
    return this.sync.upsertActivitySessions(user.sub, dto);
  }

  @Get('activity-sessions')
  listActivitySessions(
    @CurrentUser() user: RequestUser,
    @Query() query: SafeActivitySessionsQueryDto,
  ) {
    return this.sync.listActivitySessions(user.sub, query);
  }

  @Delete('activity-sessions/:id')
  deleteActivitySession(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sync.deleteActivitySession(user.sub, id);
  }

  @Public()
  @Get('health')
  activitySyncHealth() {
    return this.sync.getActivitySyncHealth();
  }
}
