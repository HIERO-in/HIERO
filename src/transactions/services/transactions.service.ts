import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between } from 'typeorm';
import { HostexTransaction, TransactionKind } from '../entities/hostex-transaction.entity';
import { UploadLog } from '../entities/upload-log.entity';
import { TransactionParserService } from './transaction-parser.service';
import { PropertiesService } from '../../properties/properties.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(HostexTransaction)
    private readonly txRepo: Repository<HostexTransaction>,
    @InjectRepository(UploadLog)
    private readonly logRepo: Repository<UploadLog>,
    private readonly parser: TransactionParserService,
    private readonly propertiesService: PropertiesService,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════ Import ═══════════

  async importFromCsv(csvText: string, fileName = 'unknown.csv'): Promise<{
    totalRows: number;
    inserted: number;
    skipped: number;
    errors: string[];
    unknownCategories: string[];
    unmatchedProperties: string[];
    insertedByCategory: Record<string, { count: number; total: number; kind: string }>;
    uploadLogId?: number;
  }> {
    const { rows, errors, unknownCategories } = this.parser.parse(csvText);
    if (rows.length === 0) {
      return { totalRows: 0, inserted: 0, skipped: 0, errors, unknownCategories, unmatchedProperties: [], insertedByCategory: {} };
    }

    // 호실 매칭: propertyTitle → propertyHostexId
    const properties = await this.propertiesService.findAll();
    const titleToHostexId = new Map<string, string>();
    const normalizedMap = new Map<string, string>();
    for (const p of properties) {
      titleToHostexId.set(p.title, String(p.hostexId));
      normalizedMap.set(this.normalize(p.title), String(p.hostexId));
    }

    const unmatchedSet = new Set<string>();
    for (const row of rows) {
      if (!row.propertyTitle) continue;
      // Tier 1: exact match
      let hid = titleToHostexId.get(row.propertyTitle);
      // Tier 2: NFC 정규화
      if (!hid) hid = normalizedMap.get(this.normalize(row.propertyTitle));
      if (hid) {
        (row as any).propertyHostexId = hid;
      } else {
        unmatchedSet.add(row.propertyTitle);
      }
    }

    if (unmatchedSet.size > 0) {
      this.logger.warn(`호실 매칭 실패 ${unmatchedSet.size}종: ${[...unmatchedSet].slice(0, 5).join(', ')}...`);
    }

    // Dedupe: 기존 해시 조회
    const hashes = rows.map((r) => r.sourceHash);
    const existing = new Set<string>();
    for (let i = 0; i < hashes.length; i += 500) {
      const chunk = hashes.slice(i, i + 500);
      const found = await this.txRepo.find({
        where: { sourceHash: In(chunk) },
        select: ['sourceHash'],
      });
      found.forEach((f) => existing.add(f.sourceHash));
    }

    // CSV 내부 중복도 제거
    const seenHashes = new Set<string>();
    const newRows = rows.filter((r) => {
      if (existing.has(r.sourceHash) || seenHashes.has(r.sourceHash)) return false;
      seenHashes.add(r.sourceHash);
      return true;
    });
    const skipped = rows.length - newRows.length;

    // 500개씩 INSERT IGNORE
    for (let i = 0; i < newRows.length; i += 500) {
      const chunk = newRows.slice(i, i + 500);
      try {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(HostexTransaction)
          .values(
            chunk.map((r) => ({
              ...r,
              paymentMethod: r.paymentMethod ?? undefined,
              rawPaymentMethod: r.rawPaymentMethod ?? undefined,
              reservationCode: r.reservationCode ?? undefined,
              checkInDate: r.checkInDate ?? undefined,
              checkOutDate: r.checkOutDate ?? undefined,
              guestName: r.guestName ?? undefined,
              channel: r.channel ?? undefined,
              propertyTitle: r.propertyTitle ?? undefined,
              propertyHostexId: (r as any).propertyHostexId ?? undefined,
              operator: r.operator ?? undefined,
              memo: r.memo ?? undefined,
            })),
          )
          .orIgnore()
          .execute();
      } catch (e) {
        this.logger.warn(`Chunk insert error: ${(e as Error).message}`);
      }
    }

    // 카테고리별 집계
    const insertedByCategory: Record<string, { count: number; total: number; kind: string }> = {};
    for (const r of newRows) {
      if (!insertedByCategory[r.category]) {
        insertedByCategory[r.category] = { count: 0, total: 0, kind: r.kind };
      }
      insertedByCategory[r.category].count++;
      insertedByCategory[r.category].total += r.amount;
    }

    this.logger.log(
      `Transaction import: ${rows.length} parsed, ${newRows.length} inserted, ${skipped} skipped, ${unmatchedSet.size} unmatched`,
    );

    // 업로드 로그 저장
    const log = this.logRepo.create({
      fileName,
      totalRows: rows.length,
      inserted: newRows.length,
      skipped,
      errorCount: errors.length,
      insertedHashes: JSON.stringify(newRows.map((r) => r.sourceHash)),
      categoryBreakdown: JSON.stringify(insertedByCategory),
    });
    await this.logRepo.save(log);

    return {
      totalRows: rows.length,
      inserted: newRows.length,
      skipped,
      errors,
      unknownCategories,
      unmatchedProperties: [...unmatchedSet],
      insertedByCategory,
      uploadLogId: log.id,
    };
  }

  private normalize(s: string): string {
    return s.normalize('NFC').replace(/[\s_\-:：]/g, '').toLowerCase();
  }

  // ═══════════ 조회 ═══════════

  async getStats(): Promise<{
    totalRows: number;
    dateRange: { min: string; max: string } | null;
    incomeCount: number;
    expenseCount: number;
    byYear: { year: number; kind: string; count: number; total: number }[];
  }> {
    const totalRows = await this.txRepo.count();
    if (totalRows === 0) return { totalRows: 0, dateRange: null, incomeCount: 0, expenseCount: 0, byYear: [] };

    const incomeCount = await this.txRepo.count({ where: { kind: TransactionKind.INCOME } });
    const expenseCount = await this.txRepo.count({ where: { kind: TransactionKind.EXPENSE } });

    const minRow = await this.txRepo.find({ order: { recordedAt: 'ASC' }, take: 1 });
    const maxRow = await this.txRepo.find({ order: { recordedAt: 'DESC' }, take: 1 });

    const byYear = await this.txRepo
      .createQueryBuilder('t')
      .select('t.year', 'year')
      .addSelect('t.kind', 'kind')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(t.amount)', 'total')
      .groupBy('t.year')
      .addGroupBy('t.kind')
      .orderBy('t.year')
      .addOrderBy('t.kind')
      .getRawMany();

    return {
      totalRows,
      dateRange: {
        min: minRow[0]?.checkInDate || '',
        max: maxRow[0]?.checkInDate || '',
      },
      incomeCount,
      expenseCount,
      byYear: byYear.map((r) => ({
        year: Number(r.year),
        kind: r.kind,
        count: Number(r.count),
        total: Number(r.total),
      })),
    };
  }

  /** 기간별 비용 요약 (recordedAt 거래일 기준) */
  async getExpenseSummary(from: string, to: string): Promise<{
    totalExpense: number;
    totalIncome: number;
    byCategory: Record<string, number>;
    byProperty: Record<string, { expense: number; income: number }>;
  }> {
    const rows = await this.txRepo.createQueryBuilder('t')
      .where('DATE(t.recordedAt) >= :from AND DATE(t.recordedAt) <= :to', { from, to })
      .getMany();

    let totalExpense = 0;
    let totalIncome = 0;
    const byCategory: Record<string, number> = {};
    const byProperty: Record<string, { expense: number; income: number }> = {};

    for (const r of rows) {
      const propKey = r.propertyTitle || '(미배정)';
      if (!byProperty[propKey]) byProperty[propKey] = { expense: 0, income: 0 };

      if (r.kind === TransactionKind.EXPENSE) {
        totalExpense += r.amount;
        byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount;
        byProperty[propKey].expense += r.amount;
      } else {
        totalIncome += r.amount;
        byProperty[propKey].income += r.amount;
      }
    }

    return { totalExpense, totalIncome, byCategory, byProperty };
  }

  /** 예약 코드로 거래 조회 */
  async findByReservationCode(code: string): Promise<HostexTransaction[]> {
    return this.txRepo.find({
      where: { reservationCode: code },
      order: { recordedAt: 'ASC' },
    });
  }

  /** 호실별 재무 — 예약별 P&L 리스트 + 전체 합산 */
  async getPropertyFinancials(
    propertyTitle: string,
    from?: string,
    to?: string,
  ) {
    const qb = this.txRepo.createQueryBuilder('t')
      .where('t.propertyTitle = :title', { title: propertyTitle });
    if (from && to) {
      qb.andWhere('t.checkInDate <= :to AND t.checkOutDate >= :from', { from, to });
    }
    const rows = await qb.orderBy('t.checkInDate', 'DESC').getMany();

    // 예약별 그룹핑
    const byReservation = new Map<string, {
      reservationCode: string;
      guestName: string;
      channel: string;
      checkIn: string;
      checkOut: string;
      income: number;
      expense: number;
      expenseBreakdown: Record<string, number>;
    }>();

    let totalIncome = 0;
    let totalExpense = 0;
    const totalExpenseBreakdown: Record<string, number> = {};

    for (const t of rows) {
      const key = t.reservationCode || `no-code-${t.id}`;
      if (!byReservation.has(key)) {
        byReservation.set(key, {
          reservationCode: t.reservationCode || '',
          guestName: t.guestName || '',
          channel: t.channel || '',
          checkIn: t.checkInDate || '',
          checkOut: t.checkOutDate || '',
          income: 0,
          expense: 0,
          expenseBreakdown: {},
        });
      }
      const entry = byReservation.get(key)!;
      if (t.kind === TransactionKind.INCOME) {
        entry.income += t.amount;
        totalIncome += t.amount;
      } else {
        entry.expense += t.amount;
        totalExpense += t.amount;
        entry.expenseBreakdown[t.category] = (entry.expenseBreakdown[t.category] ?? 0) + t.amount;
        totalExpenseBreakdown[t.category] = (totalExpenseBreakdown[t.category] ?? 0) + t.amount;
      }
    }

    const reservations = [...byReservation.values()]
      .map((r) => ({ ...r, net: r.income - r.expense, margin: r.income > 0 ? Math.round((r.income - r.expense) / r.income * 100) : 0 }))
      .sort((a, b) => (b.checkIn || '').localeCompare(a.checkIn || ''));

    return {
      propertyTitle,
      totalTransactions: rows.length,
      totalReservations: reservations.length,
      totalIncome,
      totalExpense,
      totalNet: totalIncome - totalExpense,
      totalMargin: totalIncome > 0 ? Math.round((totalIncome - totalExpense) / totalIncome * 100) : 0,
      totalExpenseBreakdown,
      reservations,
    };
  }

  /** 수동 거래 추가 */
  async createManual(dto: Partial<HostexTransaction>) {
    const tx = this.txRepo.create({
      ...dto,
      recordedAt: dto.recordedAt || new Date(),
      year: dto.year || new Date().getFullYear(),
      month: dto.month || new Date().getMonth() + 1,
      sourceHash: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
    return this.txRepo.save(tx);
  }

  /** 거래 수정 */
  async updateOne(id: number, dto: Partial<HostexTransaction>) {
    await this.txRepo.update(id, dto);
    return this.txRepo.findOneBy({ id });
  }

  /** 단건 삭제 */
  async removeOne(id: number) {
    await this.txRepo.delete(id);
    return { deleted: id };
  }

  async deleteAll(): Promise<{ deleted: number }> {
    const count = await this.txRepo.count();
    await this.txRepo.clear();
    return { deleted: count };
  }

  // ═══════════ 업로드 로그 ═══════════

  async getUploadLogs() {
    return this.logRepo.find({ order: { uploadedAt: 'DESC' } });
  }

  /** 특정 업로드 건의 거래를 모두 삭제 */
  async deleteByUploadLog(logId: number) {
    const log = await this.logRepo.findOneBy({ id: logId });
    if (!log) return { deleted: 0 };
    if (log.deleted) return { deleted: 0, message: '이미 삭제된 업로드입니다.' };

    const hashes: string[] = JSON.parse(log.insertedHashes || '[]');
    let deleted = 0;
    for (let i = 0; i < hashes.length; i += 500) {
      const chunk = hashes.slice(i, i + 500);
      const result = await this.txRepo.delete({ sourceHash: In(chunk) });
      deleted += result.affected || 0;
    }

    log.deleted = true;
    await this.logRepo.save(log);

    return { deleted, logId };
  }
}
