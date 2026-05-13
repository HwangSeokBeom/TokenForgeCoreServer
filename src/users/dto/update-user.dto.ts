import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UserSettingsDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsBoolean()
  cloudSyncOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  allowProjectAliasSync?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  nickname?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserSettingsDto)
  settings?: UserSettingsDto;
}
