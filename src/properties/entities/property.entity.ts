import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { OwnershipType } from '../enums/ownership-type.enum.js';
import { PropertyContract } from './property-contract.entity.js';
import { PropertyLandlord } from './property-landlord.entity.js';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  // ============ Hostex 연동 ============
  @Column({ type: 'bigint', unique: true })
  @Index()
  hostexId: number;

  // ============ 기본 정보 ============
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  buildingName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  roomNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  launchStage: string;

  // ============ 침대/방 구조 ============
  @Column({ type: 'int', default: 0 })
  queenBeds: number;

  @Column({ type: 'int', default: 0 })
  kingBeds: number;

  @Column({ type: 'int', default: 0 })
  doubleBeds: number;

  @Column({ type: 'int', default: 0 })
  singleBeds: number;

  @Column({ type: 'int', default: 0 })
  totalBeds: number;

  @Column({ type: 'json', nullable: true })
  amenities: string[];

  // ============ 위치 정보 ============
  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  formattedAddress: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  district: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  // ============ 이미지 ============
  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverMediumUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverSmallUrl: string;

  // ============ 운영 정보 ============
  @Column({ type: 'varchar', length: 10, nullable: true })
  checkInTime: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  checkOutTime: string;

  @Column({ type: 'varchar', length: 50, default: 'Asia/Seoul' })
  timezone: string;

  // ============ WiFi ============
  @Column({ type: 'varchar', length: 100, nullable: true })
  wifiSsid: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  wifiPassword: string;

  @Column({ type: 'text', nullable: true })
  wifiRemarks: string;

  // ============ 채널 연동 ============
  @Column({ type: 'json', nullable: true })
  channels: any[];

  // ============ 상태 ============
  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status: string;

  // ============ 운영 구분 (엑셀 '유형' 컬럼) ============
  @Column({ type: 'enum', enum: OwnershipType, nullable: true })
  @Index()
  ownershipType: OwnershipType;

  // ============ 내부 분류 코드 (엑셀 '코드' 컬럼) ============
  /**
   * 내부 숙소 코드. 예: 비어있거나 "20221121*", "02-488" 등 개별 부여값
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  internalCode: string;

  /**
   * 구역 코드. 예: H(송파 오금), D(강동 북길동), C(강동 중길동),
   *              F(강동 남길동), A(강동 천호), B(강동 복천호) 등
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  @Index()
  areaCode: string;

  /**
   * 구역명. 예: "송파 오금", "강동 북길동"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  areaName: string;

  // ============ 원본 데이터 보존 ============
  @Column({ type: 'json', nullable: true })
  rawData: any;

  // ============ 관계 ============
  @OneToMany(() => PropertyContract, (contract) => contract.property, {
    cascade: false,
  })
  contracts: PropertyContract[];

  @OneToMany(() => PropertyLandlord, (landlord) => landlord.property, {
    cascade: false,
  })
  landlords: PropertyLandlord[];

  // ============ 타임스탬프 ============
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;
}