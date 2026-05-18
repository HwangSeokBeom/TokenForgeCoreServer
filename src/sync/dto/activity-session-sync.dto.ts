import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CountBucketDto,
  DurationBucketDto,
  ConfidenceBandDto,
} from '../../sessions/dto/session-summary.dto';

export enum SafeActivitySourceProviderDto {
  MANUAL = 'MANUAL',
  GIT = 'GIT',
  CLAUDE = 'CLAUDE',
  CODEX = 'CODEX',
  UNKNOWN_AGENT = 'UNKNOWN_AGENT',
}

export class SafeBucketDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Z][A-Z0-9_:-]*$/)
  key: string;

  @IsEnum(CountBucketDto)
  countBucket: CountBucketDto;
}

export class SafeActivitySessionDto {
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  clientSessionId: string;

  @IsEnum(SafeActivitySourceProviderDto)
  sourceProvider: SafeActivitySourceProviderDto;

  @IsString()
  @Length(10, 10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dayBucket: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  timeBucket?: string;

  @IsEnum(ConfidenceBandDto)
  confidence: ConfidenceBandDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @Matches(/^[A-Z][A-Z0-9_:-]*$/, { each: true })
  warningIds?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:._-]+$/)
  analyzerVersion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:._-]+$/)
  parserVersion?: string;

  @IsOptional()
  @IsString()
  @Length(16, 133)
  @Matches(/^(hash:)?[A-Fa-f0-9]{16,128}$/)
  hashedRepositoryId?: string;

  @IsOptional()
  @IsEnum(CountBucketDto)
  changeCountBucket?: CountBucketDto;

  @IsOptional()
  @IsEnum(CountBucketDto)
  lineCountBucket?: CountBucketDto;

  @IsOptional()
  @IsEnum(CountBucketDto)
  commitCountBucket?: CountBucketDto;

  @IsOptional()
  @IsEnum(CountBucketDto)
  sessionCountBucket?: CountBucketDto;

  @IsOptional()
  @IsEnum(CountBucketDto)
  interactionCountBucket?: CountBucketDto;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Z][A-Z0-9_:-]*$/)
  activityCategory?: string;

  @IsOptional()
  @IsEnum(DurationBucketDto)
  durationBucket?: DurationBucketDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SafeBucketDto)
  categoryBuckets?: SafeBucketDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SafeBucketDto)
  languageBuckets?: SafeBucketDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SafeBucketDto)
  toolBuckets?: SafeBucketDto[];
}

export class SafeActivitySessionsUpsertRequestDto {
  @IsInt()
  @Min(1)
  @Max(1)
  schemaVersion: number;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  clientSyncId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  requestId?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SafeActivitySessionDto)
  sessions: SafeActivitySessionDto[];
}

export class SafeActivitySessionsQueryDto {
  @IsOptional()
  @IsEnum(SafeActivitySourceProviderDto)
  sourceProvider?: SafeActivitySourceProviderDto;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dayBucket?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  @Type(() => Number)
  offset?: number;
}
