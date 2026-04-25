import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Property } from './property.entity.js';

/**
 * 숙소 계약 정보 (HIERO가 임차인으로서 맺은 계약)
 *
 * 한 숙소에 여러 계약 이력 (갱신/교체) 보관 가능.
 * 현재 유효한 계약은 isActive=true 1건.
 *
 * 엑셀 컬럼 매핑:
 *   계약자 → contractorName
 *   보증금 → deposit
 *   임대료 → monthlyRent
 *   납부일 → paymentDay
 *   계약기간 → contractStart ~ contractEnd
 *   계약서(O/X) → hasContractDoc
 *   "퇴실" 메모 → isActive=false, movedOutAt
 */
@Entity('property_contracts')
export class PropertyContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  propertyId: number;

  @ManyToOne(() => Property, (property) => property.contracts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  // ============ 계약 당사자 ============
  /**
   * 계약자 (HIERO 내부 담당자 또는 명의자)
   * 예: 김진우, 왕태경, 박수빈, 김아영, 아무, 이행국 ...
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  contractorName: string;

  // ============ 금액 ============
  @Column({ type: 'bigint', nullable: true })
  deposit: number;

  @Column({ type: 'bigint', nullable: true })
  monthlyRent: number;

  /**
   * 매월 납부일 (1~31)
   */
  @Column({ type: 'int', nullable: true })
  paymentDay: number;

  // ============ 계약 기간 ============
  @Column({ type: 'date', nullable: true })
  contractStart: Date;

  @Column({ type: 'date', nullable: true })
  contractEnd: Date;

  // ============ 계약서 / 상태 ============
  /**
   * 계약서 보유 여부 (엑셀 O/X 컬럼)
   */
  @Column({ type: 'boolean', default: false })
  hasContractDoc: boolean;

  /**
   * 현재 유효한 계약인지. 퇴실/만료 시 false.
   */
  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  /**
   * 퇴실일 (계약기간에 '퇴실'로 표기된 경우)
   */
  @Column({ type: 'date', nullable: true })
  movedOutAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ============ 타임스탬프 ============
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
