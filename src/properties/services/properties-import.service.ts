import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Property } from '../entities/property.entity.js';
import { PropertyContract } from '../entities/property-contract.entity.js';
import { PropertyLandlord } from '../entities/property-landlord.entity.js';
import { OwnershipType } from '../enums/ownership-type.enum.js';

export interface ImportResult {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  unmatchedHostexIds: number[];
  propertyUpdates: number;
  contractsCreated: number;
  contractsUpdated: number;
  landlordsCreated: number;
  landlordsUpdated: number;
  errors: Array<{ row: number; hostexId: number | null; error: string }>;
  durationMs: number;
}

/**
 * XLSX 파일로부터 Property/Contract/Landlord 일괄 업서트.
 *
 * 규칙 (Q2=A: 빈 셀 무시):
 *   - hostex_id 로 기존 Property 매칭. 없으면 스킵 (신규 생성 안 함)
 *   - 빈 셀은 무시 (기존 DB 값 유지)
 *   - 값이 있는 셀만 DB에 반영
 *   - 날짜는 ExcelJS가 Date로 자동 파싱. 문자열이면 Date 변환 시도
 *   - has_contract_doc: O=true, X=false, 공란=무시
 */
@Injectable()
export class PropertiesImportService {
  private readonly logger = new Logger(PropertiesImportService.name);

  // 엑셀 헤더명 → 내부 키 매핑
  private static readonly HEADER_MAP: Record<string, string> = {
    hostex_id: 'hostex_id',
    title: 'title',
    address: 'address',
    ownership_type: 'ownership_type',
    area_code: 'area_code',
    area_name: 'area_name',
    internal_code: 'internal_code',
    contractor_name: 'contractor_name',
    deposit: 'deposit',
    monthly_rent: 'monthly_rent',
    payment_day: 'payment_day',
    contract_start: 'contract_start',
    contract_end: 'contract_end',
    has_contract_doc: 'has_contract_doc',
    contract_notes: 'contract_notes',
    account_holder: 'account_holder',
    bank_name: 'bank_name',
    account_number: 'account_number',
    landlord_phone: 'landlord_phone',
    entrance_code: 'entrance_code',
    unit_code: 'unit_code',
    wifi_ssid: 'wifi_ssid',
    wifi_password: 'wifi_password',
    wifi_remarks: 'wifi_remarks',
  };

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyContract)
    private readonly contractRepo: Repository<PropertyContract>,
    @InjectRepository(PropertyLandlord)
    private readonly landlordRepo: Repository<PropertyLandlord>,
    private readonly dataSource: DataSource,
  ) {}

  async importFromBuffer(fileBuffer: Buffer): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      unmatchedHostexIds: [],
      propertyUpdates: 0,
      contractsCreated: 0,
      contractsUpdated: 0,
      landlordsCreated: 0,
      landlordsUpdated: 0,
      errors: [],
      durationMs: 0,
    };

    // 1. 엑셀 파싱
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs 타입 정의가 최신 Node Buffer<ArrayBufferLike>와 호환 안 됨 → any 캐스트
      await workbook.xlsx.load(fileBuffer as any);
    } catch (e) {
      throw new BadRequestException(`엑셀 파일 파싱 실패: ${e.message}`);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('엑셀에 시트가 없습니다.');
    }

    // 2. 헤더 행에서 컬럼 인덱스 파악 (1행 기준)
    const headerRow = sheet.getRow(1);
    const colIndex: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const headerText = String(cell.value || '').trim();
      const key = PropertiesImportService.HEADER_MAP[headerText];
      if (key) {
        colIndex[key] = colNumber;
      }
    });

    if (!colIndex.hostex_id) {
      throw new BadRequestException(
        "필수 컬럼 'hostex_id'를 찾을 수 없습니다.",
      );
    }

    // 3. 데이터 행 순회
    const dataStartRow = 2;
    const lastRow = sheet.rowCount;

    this.logger.log(
      `Import 시작: ${lastRow - 1}행, 컬럼 ${Object.keys(colIndex).length}개 인식`,
    );

    for (let rowNum = dataStartRow; rowNum <= lastRow; rowNum++) {
      const row = sheet.getRow(rowNum);

      // 완전히 빈 행 스킵
      if (!row.hasValues) continue;

      const getCell = (key: string): any => {
        const ci = colIndex[key];
        if (!ci) return null;
        const v = row.getCell(ci).value;
        // ExcelJS 하이퍼링크/수식 객체 풀기
        if (v && typeof v === 'object' && 'result' in v) {
          return (v as any).result;
        }
        if (v && typeof v === 'object' && 'text' in v) {
          return (v as any).text;
        }
        return v;
      };

      const hostexIdRaw = getCell('hostex_id');
      if (hostexIdRaw === null || hostexIdRaw === undefined || hostexIdRaw === '') {
        continue; // 빈 hostex_id 행은 스킵
      }

      result.totalRows++;

      const hostexId = Number(hostexIdRaw);
      if (!Number.isFinite(hostexId)) {
        result.errors.push({
          row: rowNum,
          hostexId: null,
          error: `hostex_id가 숫자가 아님: ${hostexIdRaw}`,
        });
        continue;
      }

      try {
        const res = await this.upsertRow(hostexId, getCell);
        if (res.matched) {
          result.matchedRows++;
          if (res.propertyUpdated) result.propertyUpdates++;
          if (res.contractAction === 'created') result.contractsCreated++;
          if (res.contractAction === 'updated') result.contractsUpdated++;
          if (res.landlordAction === 'created') result.landlordsCreated++;
          if (res.landlordAction === 'updated') result.landlordsUpdated++;
        } else {
          result.unmatchedRows++;
          result.unmatchedHostexIds.push(hostexId);
        }
      } catch (e) {
        result.errors.push({
          row: rowNum,
          hostexId,
          error: e.message,
        });
        this.logger.error(`Row ${rowNum} (hostex_id=${hostexId}) 실패:`, e.message);
      }
    }

    result.durationMs = Date.now() - startTime;

    this.logger.log(
      `Import 완료: 매칭 ${result.matchedRows}/${result.totalRows}, ` +
        `Property 업데이트 ${result.propertyUpdates}, ` +
        `Contract 생성 ${result.contractsCreated}/수정 ${result.contractsUpdated}, ` +
        `Landlord 생성 ${result.landlordsCreated}/수정 ${result.landlordsUpdated} ` +
        `(${result.durationMs}ms)`,
    );

    return result;
  }

  /**
   * 단일 행 처리
   */
  private async upsertRow(
    hostexId: number,
    getCell: (key: string) => any,
  ): Promise<{
    matched: boolean;
    propertyUpdated: boolean;
    contractAction: 'none' | 'created' | 'updated';
    landlordAction: 'none' | 'created' | 'updated';
  }> {
    const ret = {
      matched: false,
      propertyUpdated: false,
      contractAction: 'none' as 'none' | 'created' | 'updated',
      landlordAction: 'none' as 'none' | 'created' | 'updated',
    };

    const property = await this.propertyRepo.findOne({
      where: { hostexId: hostexId as any },
    });

    if (!property) {
      return ret;
    }

    ret.matched = true;

    // 1. Property 필드 업데이트 (값 있는 것만)
    let propDirty = false;
    const ownershipRaw = this.asString(getCell('ownership_type'));
    if (ownershipRaw) {
      const valid = Object.values(OwnershipType) as string[];
      if (valid.includes(ownershipRaw)) {
        property.ownershipType = ownershipRaw as OwnershipType;
        propDirty = true;
      }
    }
    this.assignIfValue(property, 'areaCode', this.asString(getCell('area_code')));
    this.assignIfValue(property, 'areaName', this.asString(getCell('area_name')));
    this.assignIfValue(
      property,
      'internalCode',
      this.asString(getCell('internal_code')),
    );
    this.assignIfValue(property, 'wifiSsid', this.asString(getCell('wifi_ssid')));
    this.assignIfValue(
      property,
      'wifiPassword',
      this.asString(getCell('wifi_password')),
    );
    this.assignIfValue(
      property,
      'wifiRemarks',
      this.asString(getCell('wifi_remarks')),
    );

    // Property save 조건: 위에서 뭔가 바뀌었거나 ownership 바뀌었으면
    if (
      propDirty ||
      (property as any)._dirty ||
      this.hasAny(getCell, [
        'area_code',
        'area_name',
        'internal_code',
        'wifi_ssid',
        'wifi_password',
        'wifi_remarks',
      ])
    ) {
      await this.propertyRepo.save(property);
      ret.propertyUpdated = true;
    }

    // 2. Contract upsert
    const contractFields = {
      contractor_name: this.asString(getCell('contractor_name')),
      deposit: this.asNumber(getCell('deposit')),
      monthly_rent: this.asNumber(getCell('monthly_rent')),
      payment_day: this.asNumber(getCell('payment_day')),
      contract_start: this.asDate(getCell('contract_start')),
      contract_end: this.asDate(getCell('contract_end')),
      has_contract_doc: this.asOX(getCell('has_contract_doc')),
      contract_notes: this.asString(getCell('contract_notes')),
    };

    const hasContractInput = Object.values(contractFields).some(
      (v) => v !== null && v !== undefined,
    );

    if (hasContractInput) {
      let contract = await this.contractRepo.findOne({
        where: { propertyId: property.id, isActive: true },
      });

      if (!contract) {
        contract = this.contractRepo.create({
          propertyId: property.id,
          isActive: true,
        });
        ret.contractAction = 'created';
      } else {
        ret.contractAction = 'updated';
      }

      this.assignIfValue(contract, 'contractorName', contractFields.contractor_name);
      this.assignIfValue(contract, 'deposit', contractFields.deposit);
      this.assignIfValue(contract, 'monthlyRent', contractFields.monthly_rent);
      this.assignIfValue(contract, 'paymentDay', contractFields.payment_day);
      this.assignIfValue(contract, 'contractStart', contractFields.contract_start);
      this.assignIfValue(contract, 'contractEnd', contractFields.contract_end);
      if (contractFields.has_contract_doc !== null) {
        contract.hasContractDoc = contractFields.has_contract_doc;
      }
      this.assignIfValue(contract, 'notes', contractFields.contract_notes);

      await this.contractRepo.save(contract);
    }

    // 3. Landlord upsert
    const landlordFields = {
      account_holder: this.asString(getCell('account_holder')),
      bank_name: this.asString(getCell('bank_name')),
      account_number: this.asString(getCell('account_number')),
      landlord_phone: this.asString(getCell('landlord_phone')),
      entrance_code: this.asString(getCell('entrance_code')),
      unit_code: this.asString(getCell('unit_code')),
    };

    const hasLandlordInput = Object.values(landlordFields).some(
      (v) => v !== null && v !== undefined && v !== '',
    );

    if (hasLandlordInput) {
      let landlord = await this.landlordRepo.findOne({
        where: { propertyId: property.id, isActive: true },
      });

      if (!landlord) {
        landlord = this.landlordRepo.create({
          propertyId: property.id,
          isActive: true,
        });
        ret.landlordAction = 'created';
      } else {
        ret.landlordAction = 'updated';
      }

      this.assignIfValue(landlord, 'accountHolder', landlordFields.account_holder);
      this.assignIfValue(landlord, 'bankName', landlordFields.bank_name);
      this.assignIfValue(landlord, 'accountNumber', landlordFields.account_number);
      this.assignIfValue(landlord, 'phone', landlordFields.landlord_phone);
      this.assignIfValue(landlord, 'entranceCode', landlordFields.entrance_code);
      this.assignIfValue(landlord, 'unitCode', landlordFields.unit_code);

      await this.landlordRepo.save(landlord);
    }

    return ret;
  }

  // ============ 헬퍼 ============

  /** 값이 있을 때만 target[key]에 할당 (null/undefined/''는 무시) */
  private assignIfValue<T>(target: T, key: keyof T, value: any): void {
    if (value === null || value === undefined || value === '') return;
    (target as any)[key] = value;
  }

  private hasAny(getCell: (key: string) => any, keys: string[]): boolean {
    return keys.some((k) => {
      const v = getCell(k);
      return v !== null && v !== undefined && v !== '';
    });
  }

  private asString(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  private asNumber(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const cleaned = String(v).replace(/[^0-9.\-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  private asDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  private asOX(v: any): boolean | null {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).trim().toUpperCase();
    if (s === 'O' || s === 'TRUE' || s === '1') return true;
    if (s === 'X' || s === 'FALSE' || s === '0') return false;
    return null;
  }
}
