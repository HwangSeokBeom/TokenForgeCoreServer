import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
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

export class CharacterSnapshotDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
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
}
