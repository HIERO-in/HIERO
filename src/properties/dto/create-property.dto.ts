import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';
import { OwnershipType } from '../enums/ownership-type.enum.js';

/**
 * 수동 Property 생성 DTO.
 * 실제 운영에서는 PropertySyncService가 Hostex에서 자동으로 채우므로
 * 이 엔드포인트는 예외적인 수동 등록용입니다.
 *
 * 계약 정보(보증금/월세/납부일 등)와 임대인 정보(계좌/비번 등)는
 * 각각 PropertyContract / PropertyLandlord 엔티티로 분리되었으므로
 * 별도 엔드포인트에서 입력합니다.
 */
export class CreatePropertyDto {
  @IsInt()
  hostexId: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  buildingName?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  launchStage?: string;

  // ============ 위치 ============
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  // ============ 침대 ============
  @IsOptional()
  @IsInt()
  @Min(0)
  queenBeds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  kingBeds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  doubleBeds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  singleBeds?: number;

  // ============ 운영 정보 ============
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  // ============ 운영 구분 (엑셀 유형) ============
  @IsOptional()
  @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;

  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsOptional()
  @IsString()
  areaCode?: string;

  @IsOptional()
  @IsString()
  areaName?: string;

  // ============ 기타 ============
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  rawData?: Record<string, any>;
}
