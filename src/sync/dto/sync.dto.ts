import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CharacterSnapshotDto } from '../../characters/dto/character-snapshot.dto';
import {
  CountBucketDto,
  SessionSummaryUploadDto,
  SourceProviderDto,
} from '../../sessions/dto/session-summary.dto';

export class UserProgressionSyncDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  exp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  totalSafeSessionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  totalAchievementCount?: number;

  @IsOptional()
  @IsDateString()
  lastPlayedAt?: string;
}

export class AchievementProgressSyncDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  currentValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  targetValue?: number;

  @IsOptional()
  @IsEnum(CountBucketDto)
  countBucket?: CountBucketDto;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  tier?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class AchievementSyncDto {
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  achievementId: string;

  @IsOptional()
  @IsDateString()
  unlockedAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AchievementProgressSyncDto)
  progress?: AchievementProgressSyncDto;

  @IsOptional()
  @IsEnum(SourceProviderDto)
  sourceProvider?: SourceProviderDto;
}

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
  @Type(() => Number)
  sinceServerRevision?: number;
}

export class SyncPushDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  clientRevision?: number;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserProgressionSyncDto)
  userProgression?: UserProgressionSyncDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterSnapshotDto)
  characterSnapshot?: CharacterSnapshotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterSnapshotDto)
  character?: CharacterSnapshotDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionSummaryUploadDto)
  sessionSummaries?: SessionSummaryUploadDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionSummaryUploadDto)
  sessions?: SessionSummaryUploadDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AchievementSyncDto)
  achievements?: AchievementSyncDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SettingsSyncRequestDto)
  settings?: SettingsSyncRequestDto;
}

export {
  SyncPullDto as SyncPullRequestDto,
  SyncPushDto as SyncPushRequestDto,
};
