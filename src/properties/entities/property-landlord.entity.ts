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
 * 숙소 임대인/소유주 정보 (민감 데이터)
 *
 * ⚠️ 보안 주의사항:
 *   - accountNumber, entranceCode, unitCode 필드는 현재 평문 저장.
 *   - 추후 AES-256 암호화로 교체 예정 (컬럼 변경 없이 value transformer 적용).
 *   - 목록 API에서는 절대 JOIN하지 말고, 권한 확인된 상세 조회에서만 노출.
 *
 * 한 숙소에 임대인이 바뀔 수 있으므로 1:N으로 보관.
 * 현재 유효한 정보는 isActive=true.
 *
 * 엑셀 컬럼 매핑:
 *   계좌주 → accountHolder
 *   은행 → bankName
 *   계좌번호 → accountNumber
 *   현관비번 → entranceCode
 *   숙소비번 → unitCode
 */
@Entity('property_landlords')
export class PropertyLandlord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  propertyId: number;

  @ManyToOne(() => Property, (property) => property.landlords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  // ============ 임대인 정보 ============
  /**
   * 계좌주 (개인 이름 또는 법인명)
   * 예: 이행국, 최영미, ㈜하임디엔씨 등
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  accountHolder: string;

  /**
   * 임대인 연락처 (있는 경우)
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string;

  // ============ 계좌 정보 (⚠️ 민감) ============
  /**
   * 은행명: 우리/국민/기업/신한/농협/카카오/수협/전북/새마을/하나/신협 등
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  bankName: string;

  /**
   * 계좌번호 (평문. 추후 AES 암호화 예정)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  accountNumber: string;

  // ============ 출입 비밀번호 (⚠️ 민감) ============
  /**
   * 공동현관 비밀번호 (평문. 추후 AES 암호화 예정)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  entranceCode: string;

  /**
   * 숙소 도어락 비밀번호 (평문. 추후 AES 암호화 예정)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  unitCode: string;

  // ============ 상태 ============
  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ============ 타임스탬프 ============
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
