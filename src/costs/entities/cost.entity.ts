import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  OwnerType,
  RevenueBasis,
  UtilitiesMap,
} from '../enums/owner-type.enum';

@Entity('costs')
export class Cost {
  @PrimaryGeneratedColumn()
  id: number;

  // ── 숙소 식별자 (unique) ─────────────────────────
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  hostexId: string;

  // ── 소유 구조 ────────────────────────────────────
  @Column({
    type: 'enum',
    enum: OwnerType,
    default: OwnerType.LEASED,
  })
  ownerType: OwnerType;

  // ── 월세/계약 (LEASED, CONSIGNED, REVENUE_SHARE 공통) ─
  @Column({ type: 'int', default: 0 })
  rent: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rentRecipient: string | null;

  @Column({ type: 'date', nullable: true })
  contractStart: Date | null;

  @Column({ type: 'date', nullable: true })
  contractEnd: Date | null;

  @Column({ type: 'int', default: 0 })
  deposit: number;

  @Column({ type: 'text', nullable: true })
  rentMemo: string | null;

  // ── 위탁/배당 전용 ───────────────────────────────
  @Column({ type: 'int', default: 0 })
  consignedFixedPay: number;

  @Column({ type: 'boolean', default: false })
  revenueLinked: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  revenuePercent: string; // decimal은 TypeORM에서 string

  @Column({
    type: 'enum',
    enum: RevenueBasis,
    default: RevenueBasis.NET,
  })
  revenueBasis: RevenueBasis;

  // ── 자가 전용 ────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  loanInterest: number;

  @Column({ type: 'int', default: 0 })
  depreciation: number;

  @Column({ type: 'int', default: 0 })
  annualTax: number;

  // ── 공과금 (JSON) ────────────────────────────────
  @Column({ type: 'json', nullable: true })
  utilities: UtilitiesMap | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
