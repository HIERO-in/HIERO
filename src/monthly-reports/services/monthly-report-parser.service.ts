// ———————————————————————————————————————————
// HIERO · Hostex 수지보고서 CSV 파서 (백엔드 TypeScript 포팅)
// 프론트 monthlyReportParser.js 와 동일 로직.
//
// - UTF-8 BOM 제거
// - macOS NFD 한글 파일명 정규화
// - 헤더 이름 기반 인덱싱 (월별 컬럼 순서 변동 대응)
// ———————————————————————————————————————————

import { Injectable } from '@nestjs/common';

export interface SummaryRow {
  name: string;
  aor: number;
  adr: number;
  room: number;
  cleaningFee: number;
  petFee: number;
  extraFee: number;
  tax: number;
  commission: number;
  gross: number;
  cleaningCost: number;
  rentIn: number;
  rentOut: number;
  mgmt: number;
  operation: number;
  refund: number;
  labor: number;
  supplies: number;
  interior: number;
  other: number;
  totalCost: number;
  net: number;
  margin: number;
}

export interface ReservationRow {
  channel: string;
  guest: string;
  property: string;
  checkin: string;
  checkout: string;
  nights: number;
  bookedAt: string;
  room: number;
  cleaningFee: number;
  petFee: number;
  extraFee: number;
  tax: number;
  commission: number;
  gross: number;
  rentIn: number;
  rentOut: number;
  cleaningCost: number;
  mgmt: number;
  operation: number;
  labor: number;
  supplies: number;
  interior: number;
  refund: number;
  totalCost: number;
  net: number;
}

export type FileType = 'summary' | 'reservation' | 'unknown';

export interface DetectedFile {
  month: string | null;
  type: FileType;
  propertyName: string | null;
}

const SUMMARY_COLS: Record<keyof SummaryRow | string, string> = {
  name: '이름',
  aor: 'AOR',
  adr: 'ADR',
  room: '객실 요금',
  cleaningFee: '청소 요금',
  petFee: '반려동물 요금',
  extraFee: '추가 요금',
  tax: '세금',
  commission: '수수료',
  gross: '총 수입',
  cleaningCost: '청소 비용',
  rentIn: 'Rent_in',
  rentOut: 'Rent_out',
  mgmt: '관리비',
  operation: '운영 비용',
  refund: '객실 요금 환불',
  labor: '노동 비용',
  supplies: '소모품 비용',
  interior: '인테리어',
  other: '기타',
  totalCost: '총 비용',
  net: '순이익',
  margin: '순이익 비율',
};

const RESERVATION_COLS: Record<keyof ReservationRow | string, string> = {
  channel: '채널',
  guest: '게스트',
  property: '속성',
  checkin: '체크인',
  checkout: '체크아웃',
  nights: '밤',
  bookedAt: '예약 시간',
  room: '객실 요금',
  cleaningFee: '청소 요금',
  petFee: '반려동물 요금',
  extraFee: '추가 요금',
  tax: '세금',
  commission: '수수료',
  gross: '총 수입',
  rentIn: 'Rent_in',
  rentOut: 'Rent_out',
  cleaningCost: '청소 비용',
  mgmt: '관리비',
  operation: '운영 비용',
  labor: '노동 비용',
  supplies: '소모품 비용',
  interior: '인테리어',
  refund: '객실 요금 환불',
  totalCost: '총 비용',
  net: '순이익',
};

@Injectable()
export class MonthlyReportParserService {
  /** CSV 라인 파싱 (큰따옴표 이스케이프 + 인용문 안 쉼표 대응) */
  private parseCSVLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  /** 전체 CSV 텍스트 → 행렬 (큰따옴표 안 줄바꿈 보존) */
  private parseCSVText(text: string): string[][] {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const rows: string[][] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQ && text[i + 1] === '"') {
          cur += '""';
          i++;
        } else {
          inQ = !inQ;
          cur += c;
        }
      } else if ((c === '\n' || c === '\r') && !inQ) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (cur.length > 0) {
          rows.push(this.parseCSVLine(cur));
          cur = '';
        }
      } else {
        cur += c;
      }
    }
    if (cur.length > 0) rows.push(this.parseCSVLine(cur));
    return rows;
  }

  private num(s: string | undefined | null): number {
    if (s === null || s === undefined || s === '') return 0;
    const clean = String(s).replace(/,/g, '').trim();
    if (clean === '' || clean === '-') return 0;
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }

  /** 파일명 → 월/유형/호실명 추론 (NFD/NBSP 대응) */
  detectFile(rawFilename: string): DetectedFile {
    if (!rawFilename) return { month: null, type: 'unknown', propertyName: null };
    const filename = rawFilename.normalize ? rawFilename.normalize('NFC') : rawFilename;
    const normalized = filename.replace(/[\u00A0\u200B\u2028\u3000]/g, ' ');
    const collapsed = normalized.replace(/\s+/g, '');

    const dateMatch = normalized.match(/(\d{4})-(\d{2})-\d{2}/);
    const month = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}` : null;

    const isSummary =
      normalized.includes('속성 요약') ||
      normalized.includes('속성요약') ||
      collapsed.includes('속성요약');
    const isReservation =
      normalized.includes('-예약') || normalized.includes('예약.csv');

    let propertyName: string | null = null;
    if (isReservation) {
      const m = normalized.match(/속성-(.+?)-예약\.csv$/);
      if (m) propertyName = m[1];
    }

    return {
      month,
      type: isSummary ? 'summary' : isReservation ? 'reservation' : 'unknown',
      propertyName,
    };
  }

  /** 요약 CSV 파싱 → 합계 행 + 호실 행 */
  parseSummary(text: string): {
    summary: SummaryRow | null;
    properties: SummaryRow[];
    error: string | null;
  } {
    const rows = this.parseCSVText(text);
    if (rows.length < 3) {
      return { summary: null, properties: [], error: 'CSV 행 수 부족' };
    }
    const header = rows[1];
    const idx: Record<string, number> = {};
    for (const [k, col] of Object.entries(SUMMARY_COLS)) {
      idx[k] = header.indexOf(col);
    }
    if (idx.name < 0 || idx.gross < 0 || idx.net < 0) {
      return {
        summary: null,
        properties: [],
        error: `필수 컬럼 누락: ${header.slice(0, 10).join(', ')}`,
      };
    }

    const numKeys = Object.keys(SUMMARY_COLS).filter((k) => k !== 'name');
    let summary: SummaryRow | null = null;
    const properties: SummaryRow[] = [];

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const name = row[idx.name];
      if (!name) continue;
      const obj: any = { name };
      for (const k of numKeys) {
        const i = idx[k];
        obj[k] = i >= 0 && i < row.length ? this.num(row[i]) : 0;
      }
      if (name === '합계') {
        summary = obj as SummaryRow;
      } else {
        properties.push(obj as SummaryRow);
      }
    }

    return { summary, properties, error: null };
  }

  /** 예약 CSV 파싱 → 예약 배열 + 추론한 호실명 */
  parseReservation(text: string): {
    reservations: ReservationRow[];
    propertyName: string | null;
  } {
    const rows = this.parseCSVText(text);
    if (rows.length < 2) return { reservations: [], propertyName: null };
    const header = rows[1];
    const idx: Record<string, number> = {};
    for (const [k, col] of Object.entries(RESERVATION_COLS)) {
      idx[k] = header.indexOf(col);
    }
    const strKeys = ['channel', 'guest', 'property', 'checkin', 'checkout', 'bookedAt'];
    const numKeys = Object.keys(RESERVATION_COLS).filter((k) => !strKeys.includes(k));

    const reservations: ReservationRow[] = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const obj: any = {};
      for (const k of strKeys) {
        const i = idx[k];
        obj[k] = i >= 0 && i < row.length ? row[i] || '' : '';
      }
      for (const k of numKeys) {
        const i = idx[k];
        obj[k] = i >= 0 && i < row.length ? this.num(row[i]) : 0;
      }
      const hasData = obj.channel || obj.guest || obj.checkin || obj.gross !== 0;
      if (hasData) reservations.push(obj as ReservationRow);
    }
    const propertyName =
      reservations.length > 0 ? reservations[0].property : null;
    return { reservations, propertyName };
  }
}
