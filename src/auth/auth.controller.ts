import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PrivacyPolicy } from '../privacy/privacy-policy.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, LogoutDto, RefreshDto, SignupDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('guest')
  guest() {
    return this.auth.createGuest();
  }

  @Public()
  @PrivacyPolicy({ allowedForbiddenFields: ['password'] })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @PrivacyPolicy({ allowedForbiddenFields: ['password'] })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @PrivacyPolicy({ allowedForbiddenFields: ['refreshToken'] })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @PrivacyPolicy({ allowedForbiddenFields: ['refreshToken'] })
  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  deleteAccount(@CurrentUser() user: RequestUser) {
    return this.auth.requestAccountDeletion(user.sub);
  }
}
