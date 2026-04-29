import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { TransactionKind } from '../entities/hostex-transaction.entity';

// ── 카테고리 정규화 (18종) ──
const CATEGORY_MAP: Record<string, string> = {
  '객실 요금': 'ROOM',
  '청소 비용': 'CLEANING_COST',
  '관리비': 'MGMT',
  'Rent_out': 'RENT_OUT',
  'Rent_in': 'RENT_IN',
  '운영 비용': 'OPERATION',
  '객실 요금 환불': 'REFUND',
  '노동 비용': 'LABOR',
  '인테리어': 'INTERIOR',
  '소모품 비용': 'SUPPLIES',
  '유지 보수': 'MAINTENANCE',
  '기타': 'OTHER',
  // 2025 CSV에서 발견된 추가 카테고리
  '임대이자': 'LOAN_INTEREST',
  '재산 요금': 'PROPERTY_TAX',
  '배당': 'DIVIDEND',
  '프로모션 비용': 'PROMOTION',
  '부동산수수료': 'BROKERAGE_FEE',
  '배당및월세': 'DIVIDEND_RENT_IN',
  // 확장 예비
  '청소비': 'CLEANING_COST',
  '월세': 'RENT_OUT',
  '임대료': 'RENT_OUT',
  '수수료': 'COMMISSION',
  '보증금': 'DEPOSIT',
  '세금': 'TAX',
};

// ── 결제방법 표준화 ──
const PAYMENT_METHOD_MAP: Record<string, string> = {
  '에어비앤비': 'Airbnb',
  '에어비엔비': 'Airbnb',
  'Airbnb': 'Airbnb',
  'airbnb': 'Airbnb',
  '아고다': 'Agoda',
  'Agoda': 'Agoda',
  'agoda': 'Agoda',
  'Booking.com': 'Booking',
  'Booking': 'Booking',
  '부킹닷컴': 'Booking',
  '삼삼엠투': '삼삼엠투',
  '리브': '리브',
  '자리톡': '자리톡',
  'Cash': 'Cash',
  '현찰': 'Cash',
  '현금': 'Cash',
};

export interface ParsedTransaction {
  recordedAt: Date;
  year: number;
  month: number;
  kind: TransactionKind;
  category: string;
  rawCategory: string;
  amount: number;
  paymentMethod: string | null;
  rawPaymentMethod: string | null;
  reservationCode: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  guestName: string | null;
  channel: string | null;
  propertyTitle: string | null;
  operator: string | null;
  memo: string | null;
  sourceHash: string;
}

@Injectable()
export class TransactionParserService {
  private readonly logger = new Logger(TransactionParserService.name);

  parse(csvText: string): {
    rows: ParsedTransaction[];
    errors: string[];
    unknownCategories: string[];
  } {
    let text = csvText;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = this.splitLines(text);
    if (lines.length < 2) return { rows: [], errors: ['CSV 행 수 부족'], unknownCategories: [] };

    const errors: string[] = [];
    const rows: ParsedTransaction[] = [];
    const unknownCats = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      if (cols.length < 11) continue;

      try {
        const rawDate = cols[0].trim();
        const rawKind = cols[1].trim();
        const rawCategory = cols[2].trim();
        const rawAmount = cols[3].trim().replace(/,/g, '');
        const rawPayment = cols[4]?.trim() || null;
        const reservationCode = cols[5]?.trim() || null;
        const checkIn = cols[6]?.trim() || null;
        const checkOut = cols[7]?.trim() || null;
        const guestName = cols[8]?.trim() || null;
        const channel = cols[9]?.trim() || null;
        const propertyTitle = cols[10]?.trim() || null;
        const operator = cols[11]?.trim() || null;
        const memo = cols[12]?.trim() || null;

        const recordedAt = new Date(rawDate);
        if (isNaN(recordedAt.getTime())) {
          errors.push(`행 ${i + 1}: 날짜 파싱 실패 "${rawDate}"`);
          continue;
        }

        const kind = rawKind === '수입' ? TransactionKind.INCOME : TransactionKind.EXPENSE;

        // 카테고리 정규화
        let category = CATEGORY_MAP[rawCategory];
        if (!category) {
          category = 'OTHER';
          unknownCats.add(rawCategory);
        }

        const amount = Math.abs(parseInt(rawAmount, 10) || 0);

        // 결제방법 정규화
        const paymentMethod = rawPayment
          ? (PAYMENT_METHOD_MAP[rawPayment] || rawPayment)
          : null;

        // 해시 (6요소)
        const sourceHash = this.hash(
          `${rawDate}|${reservationCode || ''}|${amount}|${category}|${memo || ''}|${rawPayment || ''}`,
        );

        rows.push({
          recordedAt,
          year: recordedAt.getFullYear(),
          month: recordedAt.getMonth() + 1,
          kind,
          category,
          rawCategory,
          amount,
          paymentMethod,
          rawPaymentMethod: rawPayment,
          reservationCode,
          checkInDate: checkIn || null,
          checkOutDate: checkOut || null,
          guestName,
          channel,
          propertyTitle,
          operator,
          memo,
          sourceHash,
        });
      } catch (e) {
        errors.push(`행 ${i + 1}: ${(e as Error).message}`);
      }
    }

    if (unknownCats.size > 0) {
      this.logger.warn(`미지의 카테고리 ${unknownCats.size}종: ${[...unknownCats].join(', ')}`);
    }

    return { rows, errors, unknownCategories: [...unknownCats] };
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private splitLines(text: string): string[] {
    const lines: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') inQ = !inQ;
      else if ((c === '\n' || c === '\r') && !inQ) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (cur.trim()) lines.push(cur);
        cur = '';
        continue;
      }
      cur += c;
    }
    if (cur.trim()) lines.push(cur);
    return lines;
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
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
}
