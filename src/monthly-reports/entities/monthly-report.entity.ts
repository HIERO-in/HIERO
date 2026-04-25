// ———————————————————————————————————————————
// HIERO · 월별 Hostex 수지보고서 (월 1행)
//
// 한 행 = 한 달 분의 P&L 요약 (전체 호실 합계).
// 호실 단위 P&L 은 MonthlyReportProperty 에 저장.
// ———————————————————————————————————————————

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MonthlyReportProperty } from './monthly-report-property.entity.js';
import { MonthlyReportReservation } from './monthly-report-reservation.entity.js';

@Entity('monthly_reports')
export class MonthlyReport {
  @PrimaryGeneratedColumn()
  id: number;

  /** "YYYY-MM" 형식. 월별 유일. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 7 })
  month: string;

  // ── 합계 행 (Hostex 요약 CSV 의 "합계" 행) ──────────────
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  gross: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  commission: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCost: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  net: string;

  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0 })
  margin: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentOut: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentIn: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  cleaningCost: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  mgmt: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  operation: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  labor: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  interior: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  supplies: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  refund: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  other: string;

  // ── 메타 ───────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  totalPropertiesCount: number;

  @Column({ type: 'int', default: 0 })
  totalReservationsCount: number;

  /** 원본 CSV 파일명 (debugging) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceFilename: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ── 관계 ───────────────────────────────────────────
  @OneToMany(
    () => MonthlyReportProperty,
    (p) => p.monthlyReport,
    { cascade: true },
  )
  properties: MonthlyReportProperty[];

  @OneToMany(
    () => MonthlyReportReservation,
    (r) => r.monthlyReport,
    { cascade: true },
  )
  reservations: MonthlyReportReservation[];
}
