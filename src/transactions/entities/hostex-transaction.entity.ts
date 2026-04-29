import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TransactionKind {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

/**
 * Hostex 거래 내역 (Transactions CSV import).
 * hostex.io/app/metrics/transactions/overview 에서 CSV export.
 * 예약 단위 line-item 비용 데이터 — Health 모듈 비용 소스 Priority 1.
 */
@Entity('hostex_transactions')
@Index(['year', 'month'])
@Index(['propertyTitle'])
@Index(['reservationCode'])
export class HostexTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'datetime' })
  recordedAt: Date;

  /** YYYY (빠른 연도 필터용) */
  @Column({ type: 'smallint' })
  year: number;

  /** 1-12 (빠른 월 필터용) */
  @Column({ type: 'tinyint' })
  month: number;

  @Column({ type: 'enum', enum: TransactionKind })
  kind: TransactionKind;

  /** 정규화 카테고리 (ROOM, CLEANING_COST, MGMT, RENT_OUT 등 18종) */
  @Index()
  @Column({ type: 'varchar', length: 50 })
  category: string;

  /** CSV 원본 텍스트 */
  @Column({ type: 'varchar', length: 100 })
  rawCategory: string;

  /** 항상 양수. kind로 부호 판단 */
  @Column({ type: 'int' })
  amount: number;

  /** 정규화된 결제방법 (Airbnb, Booking 등 통합) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  paymentMethod: string;

  /** CSV 원본 결제방법 텍스트 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  rawPaymentMethod: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reservationCode: string;

  @Column({ type: 'date', nullable: true })
  checkInDate: string;

  @Column({ type: 'date', nullable: true })
  checkOutDate: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  guestName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  channel: string;

  /** CSV "관련 숙박 시설" 원본 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  propertyTitle: string;

  /** Property.hostexId — 매칭 성공 시 채움 */
  @Column({ type: 'varchar', length: 50, nullable: true })
  propertyHostexId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  operator: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  /** 중복 방지: SHA256(recordedAt + reservationCode + amount + category + memo + paymentMethod) */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  sourceHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
