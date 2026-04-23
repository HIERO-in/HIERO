import {
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class UpdateStageDto {
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  completedBy?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
