import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStageDto {
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsDateString()
  enteredAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  completedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignee?: string;

  @IsOptional()
  @IsString()
  issue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  memo?: string;
}
