import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  RequestUser,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CharacterSnapshotDto } from './dto/character-snapshot.dto';
import { CharactersService } from './characters.service';

@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.characters.getMe(user.sub);
  }

  @Put('me/snapshot')
  putSnapshot(
    @CurrentUser() user: RequestUser,
    @Body() dto: CharacterSnapshotDto,
  ) {
    return this.characters.upsertSnapshot(user.sub, dto);
  }

  @Get('me/history')
  history(@CurrentUser() user: RequestUser) {
    return this.characters.history(user.sub);
  }
}
