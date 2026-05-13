import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum WorkTypeDto {
  FEATURE = 'FEATURE',
  BUGFIX = 'BUGFIX',
  REFACTOR = 'REFACTOR',
  TEST = 'TEST',
  DOCS = 'DOCS',
  UI = 'UI',
  ARCHITECTURE = 'ARCHITECTURE',
  DEVOPS = 'DEVOPS',
  RESEARCH = 'RESEARCH',
  UNKNOWN = 'UNKNOWN',
}

export enum ResultStatusDto {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

export enum DurationBucketDto {
  UNDER_5M = 'UNDER_5M',
  M_5_15 = 'M_5_15',
  M_15_30 = 'M_15_30',
  M_30_60 = 'M_30_60',
  H_1_2 = 'H_1_2',
  H_2_PLUS = 'H_2_PLUS',
}

export enum TokenBucketDto {
  NONE = 'NONE',
  TINY = 'TINY',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  HUGE = 'HUGE',
}

export enum CountBucketDto {
  NONE = 'NONE',
  ONE = 'ONE',
  FEW = 'FEW',
  MANY = 'MANY',
  MASSIVE = 'MASSIVE',
}

export enum ConfidenceBandDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class TokenRangeDto {
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  min: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  max: number;
}

export class StatDeltasDto {
  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  logic?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  debug?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  architecture?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  design?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  stability?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  velocity?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  creativity?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  efficiency?: number;

  @IsOptional()
  @IsInt()
  @Min(-200)
  @Max(200)
  stress?: number;
}

export class EvolutionProgressDeltaDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  debugger?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  guardian?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  cleanCodeArchitect?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  tokenBerserker?: number;
}

export class SessionSummaryUploadDto {
  @IsString()
  @Length(8, 128)
  sessionId: string;

  @IsString()
  @Length(1, 40)
  agentType: string;

  @IsEnum(WorkTypeDto)
  workType: WorkTypeDto;

  @IsDateString()
  startedAt: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsEnum(DurationBucketDto)
  durationBucket: DurationBucketDto;

  @IsOptional()
  @IsEnum(TokenBucketDto)
  tokenBucket?: TokenBucketDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TokenRangeDto)
  tokenRange?: TokenRangeDto;

  @IsEnum(CountBucketDto)
  changedFileCountBucket: CountBucketDto;

  @IsEnum(CountBucketDto)
  addedLineBucket: CountBucketDto;

  @IsEnum(CountBucketDto)
  deletedLineBucket: CountBucketDto;

  @IsInt()
  @Min(0)
  @Max(100)
  testRunCount: number;

  @IsInt()
  @Min(0)
  @Max(100)
  buildRunCount: number;

  @IsEnum(ResultStatusDto)
  resultStatus: ResultStatusDto;

  @IsInt()
  @Min(0)
  @Max(10_000)
  expGained: number;

  @ValidateNested()
  @Type(() => StatDeltasDto)
  statDeltas: StatDeltasDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EvolutionProgressDeltaDto)
  evolutionProgressDelta?: EvolutionProgressDeltaDto;

  @IsEnum(ConfidenceBandDto)
  confidence: ConfidenceBandDto;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  sourceProvider?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  parserVersion?: string;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  projectHash?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  localOnlyProjectId?: string;

  // Only accepted when the user explicitly permits non-sensitive aliases.
  @IsOptional()
  @IsString()
  @Length(1, 80)
  projectAlias?: string;

  @IsOptional()
  @IsObject()
  workTypeDistribution?: Record<string, number>;
}
