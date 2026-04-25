// ———————————————————————————————————————————
// HIERO · 월별 호실 P&L 라인
// 한 행 = 한 달 + 한 호실 의 손익.
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

@Entity('monthly_report_properties')
@Index(['monthlyReportId', 'propertyName'], { unique: true })
@Index(['propertyName'])
export class MonthlyReportProperty {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  monthlyReportId: number;

  @ManyToOne(() => MonthlyReport, (m) => m.properties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monthlyReportId' })
  monthlyReport: MonthlyReport;

  /** Hostex 보고서의 "이름" 컬럼 그대로 (e.g. "A24_예건 204_수동_Q1_TV(케이블)") */
  @Column({ type: 'varchar', length: 255 })
  propertyName: string;

  /** YYYY-MM (denormalized for fast filter) */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  // ── 운영 지표 ──────────────────────────────────────
  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0 })
  aor: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  adr: string;

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
  cleaningCost: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentIn: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  rentOut: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  mgmt: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  operation: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  refund: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  labor: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  supplies: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  interior: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  other: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCost: string;

  // ── 손익 ───────────────────────────────────────────
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  net: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  margin: string;

  @CreateDateColumn()
  createdAt: Date;
}
