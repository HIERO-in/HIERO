import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { OwnerType, RevenueBasis } from '../enums/owner-type.enum';
import type { UtilitiesMap } from '../enums/owner-type.enum';

export class UpsertCostDto {
  @IsString()
  @MaxLength(100)
  hostexId: string;

  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @IsOptional()
  @IsInt()
  @Min(0)
  rent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rentRecipient?: string;

  @IsOptional()
  @IsDateString()
  contractStart?: string;

  @IsOptional()
  @IsDateString()
  contractEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deposit?: number;

  @IsOptional()
  @IsString()
  rentMemo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  consignedFixedPay?: number;

  @IsOptional()
  @IsBoolean()
  revenueLinked?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  revenuePercent?: number;

  @IsOptional()
  @IsEnum(RevenueBasis)
  revenueBasis?: RevenueBasis;

  @IsOptional()
  @IsInt()
  @Min(0)
  loanInterest?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  depreciation?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualTax?: number;

  // utilities 검증은 런타임 체크로 느슨하게 (JSON 전체 업데이트)
  @IsOptional()
  @IsObject()
  utilities?: UtilitiesMap;
}
