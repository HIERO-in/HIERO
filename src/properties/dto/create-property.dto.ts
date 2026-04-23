import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsDateString,
  IsObject,
} from 'class-validator';
import { OwnershipType, PayoutVariableBase } from '../entities/property.entity.js';

export class CreatePropertyDto {
  @IsString()
  hostex_property_id: string;

  @IsString()
  name: string;

  @IsString()
  district: string;

  @IsEnum(OwnershipType)
  ownership_type: OwnershipType;

  // 월세
  @IsOptional()
  @IsInt()
  rent_monthly?: number;

  @IsOptional()
  @IsString()
  rent_recipient?: string;

  @IsOptional()
  @IsDateString()
  rent_contract_start?: string;

  @IsOptional()
  @IsDateString()
  rent_contract_end?: string;

  @IsOptional()
  @IsInt()
  rent_deposit?: number;

  // 위탁/배당
  @IsOptional()
  @IsInt()
  payout_fixed_monthly?: number;

  @IsOptional()
  @IsInt()
  payout_variable_percent?: number;

  @IsOptional()
  @IsEnum(PayoutVariableBase)
  payout_variable_base?: PayoutVariableBase;

  // 자가
  @IsOptional()
  @IsInt()
  owned_loan_interest?: number;

  @IsOptional()
  @IsInt()
  owned_depreciation?: number;

  @IsOptional()
  @IsInt()
  owned_property_tax_annual?: number;

  // 공과금
  @IsOptional()
  @IsObject()
  utilities?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
