import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsNumber,
  MaxLength,
  ArrayMaxSize,
  Min,
} from 'class-validator';

export class CreateLaunchDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerUserId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  benchmarkHostexIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedMonthlyRevenue?: number;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
