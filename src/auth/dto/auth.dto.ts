import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  nickname?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 512)
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @Length(20, 512)
  refreshToken: string;
}
