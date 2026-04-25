// ———————————————————————————————————————————
// HIERO · 월별 리포트 핵심 서비스
// CRUD + 임포트(여러 CSV 한 번에) + 분석 쿼리
// ———————————————————————————————————————————

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { MonthlyReport } from '../entities/monthly-report.entity.js';
import { MonthlyReportProperty } from '../entities/monthly-report-property.entity.js';
import { MonthlyReportReservation } from '../entities/monthly-report-reservation.entity.js';
import {
  MonthlyReportParserService,
  SummaryRow,
  ReservationRow,
} from './monthly-report-parser.service.js';

export interface UploadedCsvFile {
  originalname: string;
  buffer: Buffer;
}

export interface ImportLogEntry {
  filename: string;
  ok: boolean;
  message: string;
}

@Injectable()
export class MonthlyReportsService {
  constructor(
    @InjectRepository(MonthlyReport)
    private readonly reportRepo: Repository<MonthlyReport>,
    @InjectRepository(MonthlyReportProperty)
    private readonly propertyRepo: Repository<MonthlyReportProperty>,
    @InjectRepository(MonthlyReportReservation)
    private readonly reservationRepo: Repository<MonthlyReportReservation>,
    private readonly parser: MonthlyReportParserService,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════ 조회 ═══════════
  async list() {
    const rows = await this.reportRepo.find({
      order: { month: 'ASC' },
    });
    return rows.map((r) => ({
      ...r,
      gross: Number(r.gross),
      commission: Number(r.commission),
      totalCost: Number(r.totalCost),
      net: Number(r.net),
      margin: Number(r.margin),
      rentOut: Number(r.rentOut),
      rentIn: Number(r.rentIn),
      cleaningCost: Number(r.cleaningCost),
      mgmt: Number(r.mgmt),
      operation: Number(r.operation),
      labor: Number(r.labor),
      interior: Number(r.interior),
      supplies: Number(r.supplies),
      refund: Number(r.refund),
      other: Number(r.other),
    }));
  }

  async getMonth(month: string) {
    const report = await this.reportRepo.findOne({
      where: { month },
      relations: ['properties', 'reservations'],
    });
    if (!report) return null;
    return this.serializeMonth(report);
  }

  /** 호실 1개의 모든 월 시계열 */
  async getPropertyHistory(propertyName: string) {
    const rows = await this.propertyRepo.find({
      where: { propertyName },
      order: { month: 'ASC' },
    });
    return rows.map((r) => this.serializeProperty(r));
  }

  /** 호실 평균 (최근 N개월) */
  async getPropertyAverage(propertyName: string, recentMonths = 12) {
    const rows = await this.propertyRepo.find({
      where: { propertyName },
      order: { month: 'DESC' },
      take: recentMonths,
    });
    if (rows.length === 0) return null;
    const sum: any = {
      rentOut: 0, cleaningCost: 0, mgmt: 0, operation: 0, labor: 0,
      interior: 0, refund: 0, supplies: 0, rentIn: 0, gross: 0,
      commission: 0, net: 0,
    };
    for (const r of rows) {
      sum.rentOut += Number(r.rentOut);
      sum.cleaningCost += Number(r.cleaningCost);
      sum.mgmt += Number(r.mgmt);
      sum.operation += Number(r.operation);
      sum.labor += Number(r.labor);
      sum.interior += Number(r.interior);
      sum.refund += Number(r.refund);
      sum.supplies += Number(r.supplies);
      sum.rentIn += Number(r.rentIn);
      sum.gross += Number(r.gross);
      sum.commission += Number(r.commission);
      sum.net += Number(r.net);
    }
    const avg: any = { propertyName, monthsObserved: rows.length };
    for (const k of Object.keys(sum)) avg[k] = sum[k] / rows.length;
    return avg;
  }

  /** 모든 호실명 (모든 월에서 등장한 적 있음) */
  async getAllPropertyNames() {
    const rows = await this.propertyRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.propertyName', 'name')
      .orderBy('p.propertyName', 'ASC')
      .getRawMany();
    return rows.map((r) => r.name as string);
  }

  /** 카테고리별 합계 (전 기간 또는 특정 월들) */
  async getCategoryTotals(months?: string[]) {
    const qb = this.reportRepo.createQueryBuilder('r').select([
      'SUM(r.gross) AS gross',
      'SUM(r.commission) AS commission',
      'SUM(r.totalCost) AS totalCost',
      'SUM(r.net) AS net',
      'SUM(r.rentOut) AS rentOut',
      'SUM(r.rentIn) AS rentIn',
      'SUM(r.cleaningCost) AS cleaningCost',
      'SUM(r.mgmt) AS mgmt',
      'SUM(r.operation) AS operation',
      'SUM(r.labor) AS labor',
      'SUM(r.interior) AS interior',
      'SUM(r.supplies) AS supplies',
      'SUM(r.refund) AS refund',
      'SUM(r.other) AS other',
    ]);
    if (months && months.length > 0) {
      qb.where('r.month IN (:...months)', { months });
    }
    const raw = await qb.getRawOne();
    if (!raw) return null;
    const obj: any = {};
    for (const k of Object.keys(raw)) obj[k] = Number(raw[k] || 0);
    return obj;
  }

  /** 여러 월의 호실 P&L 일괄 조회 (Health 모듈용) */
  async findPropertiesByMonths(
    months: string[],
  ): Promise<MonthlyReportProperty[]> {
    if (months.length === 0) return [];
    return this.propertyRepo.find({
      where: { month: In(months) },
      order: { propertyName: 'ASC', month: 'ASC' },
    });
  }

  // ═══════════ 임포트 ═══════════
  /** 여러 CSV 파일을 묶음으로 받아 월별로 그룹핑 후 저장 (트랜잭션) */
  async importFromFiles(files: UploadedCsvFile[]): Promise<{
    log: ImportLogEntry[];
    savedMonths: string[];
  }> {
    const log: ImportLogEntry[] = [];
    if (!files || files.length === 0) {
      throw new BadRequestException('CSV 파일이 업로드되지 않았습니다.');
    }

    // ── 월별로 그룹핑 ──
    type MonthData = {
      summaryFile?: { name: string; summary: SummaryRow; properties: SummaryRow[] };
      reservationFiles: { name: string; propertyName: string; reservations: ReservationRow[] }[];
    };
    const byMonth: Record<string, MonthData> = {};

    for (const file of files) {
      const meta = this.parser.detectFile(file.originalname);
      if (!meta.month) {
        log.push({
          filename: file.originalname,
          ok: false,
          message: '파일명에서 월(YYYY-MM-DD)을 못 찾음',
        });
        continue;
      }
      const text = file.buffer.toString('utf8');
      if (!byMonth[meta.month])
        byMonth[meta.month] = { reservationFiles: [] };

      if (meta.type === 'summary') {
        const parsed = this.parser.parseSummary(text);
        if (parsed.error || !parsed.summary) {
          log.push({
            filename: file.originalname,
            ok: false,
            message: `요약 파싱 실패: ${parsed.error || '합계 행 없음'}`,
          });
          continue;
        }
        byMonth[meta.month].summaryFile = {
          name: file.originalname,
          summary: parsed.summary,
          properties: parsed.properties,
        };
        log.push({
          filename: file.originalname,
          ok: true,
          message: `요약 · ${parsed.properties.length}호실 · 순이익 ${Math.round(parsed.summary.net).toLocaleString()}원`,
        });
      } else if (meta.type === 'reservation') {
        const parsed = this.parser.parseReservation(text);
        if (!parsed.propertyName) {
          log.push({
            filename: file.originalname,
            ok: false,
            message: '예약 CSV 에서 호실명 미검출',
          });
          continue;
        }
        byMonth[meta.month].reservationFiles.push({
          name: file.originalname,
          propertyName: parsed.propertyName,
          reservations: parsed.reservations,
        });
        log.push({
          filename: file.originalname,
          ok: true,
          message: `예약상세 · ${parsed.reservations.length}건 · ${parsed.propertyName}`,
        });
      } else {
        log.push({
          filename: file.originalname,
          ok: false,
          message: '유형 불명 (요약/예약 패턴 매치 실패)',
        });
      }
    }

    // ── 월 단위 저장 (요약 있는 월만) ──
    const savedMonths: string[] = [];
    for (const [month, data] of Object.entries(byMonth)) {
      if (!data.summaryFile) {
        log.push({
          filename: `[${month}]`,
          ok: false,
          message: '요약 CSV 없음 - 저장 안함',
        });
        continue;
      }
      await this.saveMonthTransaction(month, data);
      savedMonths.push(month);
    }
    log.push({
      filename: '—',
      ok: true,
      message: `${savedMonths.length}개 월 저장 완료`,
    });

    return { log, savedMonths };
  }

  /** 한 달 데이터를 트랜잭션으로 저장. 기존 데이터는 삭제 후 덮어쓰기. */
  private async saveMonthTransaction(
    month: string,
    data: {
      summaryFile?: { name: string; summary: SummaryRow; properties: SummaryRow[] };
      reservationFiles: { name: string; propertyName: string; reservations: ReservationRow[] }[];
    },
  ) {
    if (!data.summaryFile) return;

    await this.dataSource.transaction(async (mgr) => {
      const reportRepo = mgr.getRepository(MonthlyReport);
      const propRepo = mgr.getRepository(MonthlyReportProperty);
      const resRepo = mgr.getRepository(MonthlyReportReservation);

      // 기존 월 삭제 (CASCADE 가 children 도 같이)
      const existing = await reportRepo.findOne({ where: { month } });
      if (existing) {
        await reportRepo.delete({ id: existing.id });
      }

      // 새 MonthlyReport 생성 (summaryFile 존재 보장 — 진입 가드)
      const summaryFile = data.summaryFile!;
      const s = summaryFile.summary;
      const totalReservations = data.reservationFiles.reduce(
        (sum, f) => sum + f.reservations.length,
        0,
      );
      const report = reportRepo.create({
        month,
        gross: String(s.gross),
        commission: String(s.commission),
        totalCost: String(s.totalCost),
        net: String(s.net),
        margin: String(s.margin || 0),
        rentOut: String(s.rentOut),
        rentIn: String(s.rentIn),
        cleaningCost: String(s.cleaningCost),
        mgmt: String(s.mgmt),
        operation: String(s.operation),
        labor: String(s.labor),
        interior: String(s.interior),
        supplies: String(s.supplies),
        refund: String(s.refund),
        other: String(s.other),
        totalPropertiesCount: summaryFile.properties.length,
        totalReservationsCount: totalReservations,
        sourceFilename: summaryFile.name,
      });
      const saved = await reportRepo.save(report);

      // 호실별 P&L 일괄 삽입
      const propRows: Partial<MonthlyReportProperty>[] = summaryFile.properties.map((p) => ({
        monthlyReportId: saved.id,
        month,
        propertyName: p.name,
        aor: String(p.aor),
        adr: String(p.adr),
        room: String(p.room),
        cleaningFee: String(p.cleaningFee),
        petFee: String(p.petFee),
        extraFee: String(p.extraFee),
        tax: String(p.tax),
        commission: String(p.commission),
        gross: String(p.gross),
        cleaningCost: String(p.cleaningCost),
        rentIn: String(p.rentIn),
        rentOut: String(p.rentOut),
        mgmt: String(p.mgmt),
        operation: String(p.operation),
        refund: String(p.refund),
        labor: String(p.labor),
        supplies: String(p.supplies),
        interior: String(p.interior),
        other: String(p.other),
        totalCost: String(p.totalCost),
        net: String(p.net),
        margin: String(p.margin || 0),
      }));
      if (propRows.length > 0) {
        await propRepo.insert(propRows);
      }

      // 예약 디테일 일괄 삽입
      const resRows: Partial<MonthlyReportReservation>[] = [];
      for (const f of data.reservationFiles) {
        for (const r of f.reservations) {
          resRows.push({
            monthlyReportId: saved.id,
            month,
            propertyName: f.propertyName,
            channel: r.channel || null,
            guest: r.guest || null,
            checkin: r.checkin || null,
            checkout: r.checkout || null,
            nights: Math.round(r.nights || 0),
            bookedAt: r.bookedAt || null,
            room: String(r.room),
            cleaningFee: String(r.cleaningFee),
            petFee: String(r.petFee),
            extraFee: String(r.extraFee),
            tax: String(r.tax),
            commission: String(r.commission),
            gross: String(r.gross),
            rentIn: String(r.rentIn),
            rentOut: String(r.rentOut),
            cleaningCost: String(r.cleaningCost),
            mgmt: String(r.mgmt),
            operation: String(r.operation),
            labor: String(r.labor),
            supplies: String(r.supplies),
            interior: String(r.interior),
            refund: String(r.refund),
            totalCost: String(r.totalCost),
            net: String(r.net),
          });
        }
      }
      // MySQL packet limit 회피: 500개씩 청크 삽입
      for (let i = 0; i < resRows.length; i += 500) {
        const chunk = resRows.slice(i, i + 500);
        if (chunk.length > 0) await resRepo.insert(chunk);
      }
    });
  }

  // ═══════════ 삭제 ═══════════
  async deleteMonth(month: string) {
    const r = await this.reportRepo.findOne({ where: { month } });
    if (!r) return { deleted: false };
    await this.reportRepo.delete({ id: r.id });
    return { deleted: true, month };
  }

  // ═══════════ 직렬화 헬퍼 ═══════════
  private serializeProperty(p: MonthlyReportProperty) {
    return {
      ...p,
      aor: Number(p.aor),
      adr: Number(p.adr),
      room: Number(p.room),
      cleaningFee: Number(p.cleaningFee),
      petFee: Number(p.petFee),
      extraFee: Number(p.extraFee),
      tax: Number(p.tax),
      commission: Number(p.commission),
      gross: Number(p.gross),
      cleaningCost: Number(p.cleaningCost),
      rentIn: Number(p.rentIn),
      rentOut: Number(p.rentOut),
      mgmt: Number(p.mgmt),
      operation: Number(p.operation),
      refund: Number(p.refund),
      labor: Number(p.labor),
      supplies: Number(p.supplies),
      interior: Number(p.interior),
      other: Number(p.other),
      totalCost: Number(p.totalCost),
      net: Number(p.net),
      margin: Number(p.margin),
    };
  }

  private serializeReservation(r: MonthlyReportReservation) {
    return {
      ...r,
      room: Number(r.room),
      cleaningFee: Number(r.cleaningFee),
      petFee: Number(r.petFee),
      extraFee: Number(r.extraFee),
      tax: Number(r.tax),
      commission: Number(r.commission),
      gross: Number(r.gross),
      rentIn: Number(r.rentIn),
      rentOut: Number(r.rentOut),
      cleaningCost: Number(r.cleaningCost),
      mgmt: Number(r.mgmt),
      operation: Number(r.operation),
      labor: Number(r.labor),
      supplies: Number(r.supplies),
      interior: Number(r.interior),
      refund: Number(r.refund),
      totalCost: Number(r.totalCost),
      net: Number(r.net),
    };
  }

  private serializeMonth(report: MonthlyReport) {
    return {
      ...report,
      gross: Number(report.gross),
      commission: Number(report.commission),
      totalCost: Number(report.totalCost),
      net: Number(report.net),
      margin: Number(report.margin),
      rentOut: Number(report.rentOut),
      rentIn: Number(report.rentIn),
      cleaningCost: Number(report.cleaningCost),
      mgmt: Number(report.mgmt),
      operation: Number(report.operation),
      labor: Number(report.labor),
      interior: Number(report.interior),
      supplies: Number(report.supplies),
      refund: Number(report.refund),
      other: Number(report.other),
      properties: (report.properties || []).map((p) =>
        this.serializeProperty(p),
      ),
      reservations: (report.reservations || []).map((r) =>
        this.serializeReservation(r),
      ),
    };
  }
}
