import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AchievementsService } from './achievements.service';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  list() {
    return this.achievements.list();
  }

  @Get('me')
  mine(@CurrentUser() user: RequestUser) {
    return this.achievements.myAchievements(user.sub);
  }
}
