import { Type } from 'class-transformer';
import {
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

export class UploadSessionSummaryDto {
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  sessionId: string;

  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:_-]+$/)
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

  @IsEnum(TokenBucketDto)
  tokenBucket: TokenBucketDto;

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
  @Matches(/^[A-Za-z0-9:._-]+$/)
  sourceProvider?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:._-]+$/)
  parserVersion?: string;

  @IsOptional()
  @IsString()
  @Length(16, 128)
  @Matches(/^[A-Fa-f0-9:_-]+$/)
  projectHash?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  localOnlyProjectId?: string;
}

export class DeleteSessionDto {
  @IsString()
  @Length(36, 36)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  id: string;
}

export { UploadSessionSummaryDto as SessionSummaryUploadDto };
