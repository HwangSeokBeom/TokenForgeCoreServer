import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionSummaryUploadDto } from './dto/session-summary.dto';
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('summary')
  createSummary(
    @CurrentUser() user: RequestUser,
    @Body() dto: SessionSummaryUploadDto,
  ) {
    return this.sessions.createSummary(user.sub, dto);
  }

  @Get('summary')
  list(@CurrentUser() user: RequestUser) {
    return this.sessions.listSummaries(user.sub);
  }

  @Delete('summary/:id')
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.sessions.deleteSummary(user.sub, id);
  }
}
