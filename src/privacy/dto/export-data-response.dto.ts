import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class ExportDataResponseDto {
  @IsDateString()
  exportedAt: string;

  @IsString()
  note: string;

  @IsOptional()
  @IsObject()
  user?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  character?: Record<string, unknown> | null;

  @IsArray()
  sessionSummaries: Array<Record<string, unknown>>;

  @IsArray()
  achievements: Array<Record<string, unknown>>;

  @IsArray()
  syncStates: Array<Record<string, unknown>>;

  @IsArray()
  devices: Array<Record<string, unknown>>;
}
