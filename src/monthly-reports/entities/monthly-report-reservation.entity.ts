// ———————————————————————————————————————————
// HIERO · 월별 예약 디테일 라인
// Hostex 호실별 "예약" CSV 의 각 행.
// 호실별 CSV가 제공된 호실만 데이터 있음 (전체 호실 X).
// ———————————————————————————————————————————

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MonthlyReport } from './monthly-report.entity.js';

@Entity('monthly_report_reservations')
@Index(['monthlyReportId', 'propertyName'])
@Index(['propertyName', 'checkin'])
export class MonthlyReportReservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  monthlyReportId: number;

  @ManyToOne(() => MonthlyReport, (m) => m.reservations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monthlyReportId' })
  monthlyReport: MonthlyReport;

  /** YYYY-MM (denormalized) */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  /** 호실명 (CSV "속성" 컬럼) */
  @Column({ type: 'varchar', length: 255 })
  propertyName: string;

  // ── 예약 메타 ──────────────────────────────────────
  @Column({ type: 'varchar', length: 100, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  guest: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  checkin: string | null; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 30, nullable: true })
  checkout: string | null;

  @Column({ type: 'int', default: 0 })
  nights: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  bookedAt: string | null;

  // ── 수입 ───────────────────────────────────────────
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  room: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  cleaningFee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  petFee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  extraFee: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  tax: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  commission: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  gross: string;

  // ── 비용 ───────────────────────────────────────────
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentIn: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentOut: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  cleaningCost: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  mgmt: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  operation: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  labor: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  supplies: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  interior: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  refund: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCost: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  net: string;

  @CreateDateColumn()
  createdAt: Date;
}
