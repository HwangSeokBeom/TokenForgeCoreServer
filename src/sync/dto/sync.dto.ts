import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CharacterSnapshotDto } from '../../characters/dto/character-snapshot.dto';
import { SessionSummaryUploadDto } from '../../sessions/dto/session-summary.dto';

export class SettingsSyncRequestDto {
  @IsOptional()
  @IsBoolean()
  cloudSyncOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  allowProjectAliasSync?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  theme?: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  syncVersion: number;
}

export class SyncPullRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  sinceSyncVersion?: string;
}

export class SyncPushRequestDto {
  @IsOptional()
  @IsString()
  @Length(8, 128)
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterSnapshotDto)
  characterSnapshot?: CharacterSnapshotDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SessionSummaryUploadDto)
  sessionSummaries?: SessionSummaryUploadDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsSyncRequestDto)
  settings?: SettingsSyncRequestDto;

  @IsOptional()
  @IsObject()
  tombstones?: Record<string, string[]>;
}
