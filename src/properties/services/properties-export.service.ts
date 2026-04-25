import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Property } from '../entities/property.entity.js';
import { OwnershipType } from '../enums/ownership-type.enum.js';

/**
 * 숙소 데이터를 XLSX 파일로 내보내는 서비스.
 *
 * 1행 = 1숙소 (98개 기준)
 * 컬럼 그룹:
 *   A-C: 읽기전용 식별자 (Hostex 동기화 유지)
 *   D-G: 운영구분 (우리가 관리)
 *   H-O: 현재 계약 정보
 *   P-S: 임대인/계좌
 *   T-U: 출입 비밀번호
 *   V-X: WiFi
 */
@Injectable()
export class PropertiesExportService {
  private readonly logger = new Logger(PropertiesExportService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  async exportAll(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HIERO OAI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Properties', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
    });

    // 컬럼 정의
    sheet.columns = [
      // A-C: 읽기전용 (Hostex)
      { header: 'hostex_id', key: 'hostex_id', width: 12 },
      { header: 'title', key: 'title', width: 40 },
      { header: 'address', key: 'address', width: 35 },

      // D-G: 운영 구분
      { header: 'ownership_type', key: 'ownership_type', width: 12 },
      { header: 'area_code', key: 'area_code', width: 10 },
      { header: 'area_name', key: 'area_name', width: 16 },
      { header: 'internal_code', key: 'internal_code', width: 14 },

      // H-O: 현재 계약
      { header: 'contractor_name', key: 'contractor_name', width: 12 },
      { header: 'deposit', key: 'deposit', width: 12 },
      { header: 'monthly_rent', key: 'monthly_rent', width: 12 },
      { header: 'payment_day', key: 'payment_day', width: 10 },
      { header: 'contract_start', key: 'contract_start', width: 12 },
      { header: 'contract_end', key: 'contract_end', width: 12 },
      { header: 'has_contract_doc', key: 'has_contract_doc', width: 8 },
      { header: 'contract_notes', key: 'contract_notes', width: 24 },

      // P-S: 임대인 / 계좌
      { header: 'account_holder', key: 'account_holder', width: 15 },
      { header: 'bank_name', key: 'bank_name', width: 10 },
      { header: 'account_number', key: 'account_number', width: 25 },
      { header: 'landlord_phone', key: 'landlord_phone', width: 15 },

      // T-U: 출입 비밀번호
      { header: 'entrance_code', key: 'entrance_code', width: 12 },
      { header: 'unit_code', key: 'unit_code', width: 12 },

      // V-X: WiFi
      { header: 'wifi_ssid', key: 'wifi_ssid', width: 20 },
      { header: 'wifi_password', key: 'wifi_password', width: 16 },
      { header: 'wifi_remarks', key: 'wifi_remarks', width: 24 },
    ];

    // 헤더 스타일 (굵게 + 회색 배경)
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.height = 22;

    // 읽기전용 컬럼 (A-C) 배경 연한 파랑
    for (let col = 1; col <= 3; col++) {
      sheet.getCell(1, col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6E4F0' },
      };
    }

    // 데이터 조회 (관계 포함)
    const properties = await this.propertyRepo.find({
      relations: { contracts: true, landlords: true },
      order: { id: 'ASC' },
    });

    this.logger.log(`Exporting ${properties.length} properties`);

    for (const prop of properties) {
      // 현재 유효한 계약/임대인 선택 (isActive=true 우선, 없으면 가장 최근)
      const activeContract =
        prop.contracts?.find((c) => c.isActive) ||
        prop.contracts?.sort(
          (a, b) =>
            (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
        )[0];

      const activeLandlord =
        prop.landlords?.find((l) => l.isActive) ||
        prop.landlords?.sort(
          (a, b) =>
            (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
        )[0];

      sheet.addRow({
        hostex_id: prop.hostexId,
        title: prop.title,
        address: prop.address || prop.formattedAddress || '',

        ownership_type: prop.ownershipType || '',
        area_code: prop.areaCode || '',
        area_name: prop.areaName || '',
        internal_code: prop.internalCode || '',

        contractor_name: activeContract?.contractorName || '',
        deposit: activeContract?.deposit ?? null,
        monthly_rent: activeContract?.monthlyRent ?? null,
        payment_day: activeContract?.paymentDay ?? null,
        contract_start: activeContract?.contractStart || null,
        contract_end: activeContract?.contractEnd || null,
        has_contract_doc: activeContract
          ? activeContract.hasContractDoc
            ? 'O'
            : 'X'
          : '',
        contract_notes: activeContract?.notes || '',

        account_holder: activeLandlord?.accountHolder || '',
        bank_name: activeLandlord?.bankName || '',
        account_number: activeLandlord?.accountNumber || '',
        landlord_phone: activeLandlord?.phone || '',

        entrance_code: activeLandlord?.entranceCode || '',
        unit_code: activeLandlord?.unitCode || '',

        wifi_ssid: prop.wifiSsid || '',
        wifi_password: prop.wifiPassword || '',
        wifi_remarks: prop.wifiRemarks || '',
      });
    }

    // ownership_type 컬럼에 드롭다운 검증 추가 (D열, 2행부터 넉넉히 500행까지)
    const allowedTypes = Object.values(OwnershipType).join(',');
    for (let row = 2; row <= Math.max(500, properties.length + 50); row++) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${allowedTypes}"`],
        showErrorMessage: true,
        errorTitle: '유형 오류',
        error: '단기임대/대위변제/전세/경매/남의집 중에서 선택하세요.',
      };
    }

    // 금액 컬럼 천단위 콤마 (deposit, monthly_rent)
    sheet.getColumn('deposit').numFmt = '#,##0';
    sheet.getColumn('monthly_rent').numFmt = '#,##0';

    // 날짜 컬럼 형식
    sheet.getColumn('contract_start').numFmt = 'yyyy-mm-dd';
    sheet.getColumn('contract_end').numFmt = 'yyyy-mm-dd';

    // AutoFilter (1행 기준)
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  /**
   * 빈 템플릿 (헤더만, 데이터 행 없음)
   */
  async exportTemplate(): Promise<Buffer> {
    // exportAll과 동일 구조로 만들되 데이터만 비움
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HIERO OAI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Properties', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'hostex_id', key: 'hostex_id', width: 12 },
      { header: 'title', key: 'title', width: 40 },
      { header: 'address', key: 'address', width: 35 },
      { header: 'ownership_type', key: 'ownership_type', width: 12 },
      { header: 'area_code', key: 'area_code', width: 10 },
      { header: 'area_name', key: 'area_name', width: 16 },
      { header: 'internal_code', key: 'internal_code', width: 14 },
      { header: 'contractor_name', key: 'contractor_name', width: 12 },
      { header: 'deposit', key: 'deposit', width: 12 },
      { header: 'monthly_rent', key: 'monthly_rent', width: 12 },
      { header: 'payment_day', key: 'payment_day', width: 10 },
      { header: 'contract_start', key: 'contract_start', width: 12 },
      { header: 'contract_end', key: 'contract_end', width: 12 },
      { header: 'has_contract_doc', key: 'has_contract_doc', width: 8 },
      { header: 'contract_notes', key: 'contract_notes', width: 24 },
      { header: 'account_holder', key: 'account_holder', width: 15 },
      { header: 'bank_name', key: 'bank_name', width: 10 },
      { header: 'account_number', key: 'account_number', width: 25 },
      { header: 'landlord_phone', key: 'landlord_phone', width: 15 },
      { header: 'entrance_code', key: 'entrance_code', width: 12 },
      { header: 'unit_code', key: 'unit_code', width: 12 },
      { header: 'wifi_ssid', key: 'wifi_ssid', width: 20 },
      { header: 'wifi_password', key: 'wifi_password', width: 16 },
      { header: 'wifi_remarks', key: 'wifi_remarks', width: 24 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
}
