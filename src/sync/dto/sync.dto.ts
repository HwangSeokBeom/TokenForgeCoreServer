import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
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
  @Matches(/^[A-Za-z0-9:_-]+$/)
  theme?: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  syncVersion: number;
}

export class SyncPullDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  deviceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  sinceSyncVersion?: number;
}

export class SyncPushDto {
  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterSnapshotDto)
  characterSnapshot?: CharacterSnapshotDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
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

export {
  SyncPullDto as SyncPullRequestDto,
  SyncPushDto as SyncPushRequestDto,
};
