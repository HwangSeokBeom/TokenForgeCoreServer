import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CharacterClassDto {
  APPRENTICE = 'APPRENTICE',
  DEBUGGER = 'DEBUGGER',
  GUARDIAN = 'GUARDIAN',
  CLEAN_CODE_ARCHITECT = 'CLEAN_CODE_ARCHITECT',
  TOKEN_BERSERKER = 'TOKEN_BERSERKER',
}

export class CharacterStatsDto {
  @IsInt()
  @Min(0)
  @Max(9999)
  logic: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  debug: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  architecture: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  design: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  stability: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  velocity: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  creativity: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  efficiency: number;

  @IsInt()
  @Min(0)
  @Max(9999)
  stress: number;
}

export class CharacterEvolutionSyncDto {
  @IsOptional()
  @IsEnum(CharacterClassDto)
  targetClass?: CharacterClassDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  progress?: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  stage?: string;
}

export class CharacterAppearanceSyncDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  avatarId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  paletteId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Za-z0-9:_-]+$/)
  frameId?: string;
}

export class CharacterSnapshotSyncDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^[\p{L}\p{N} _.-]+$/u)
  displayName?: string;

  @IsInt()
  @Min(1)
  @Max(999)
  level: number;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  exp: number;

  @IsEnum(CharacterClassDto)
  class: CharacterClassDto;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  syncVersion: number;

  @ValidateNested()
  @Type(() => CharacterStatsDto)
  stats: CharacterStatsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterEvolutionSyncDto)
  evolution?: CharacterEvolutionSyncDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CharacterAppearanceSyncDto)
  appearance?: CharacterAppearanceSyncDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  @Matches(/^[A-Za-z0-9:_-]+$/, { each: true })
  unlockedItems?: string[];
}

export { CharacterSnapshotSyncDto as CharacterSnapshotDto };
