import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OwnershipType {
  OWNED = 'OWNED',
  LEASED = 'LEASED',
  CONSIGNED = 'CONSIGNED',
  REVENUE_SHARE = 'REVENUE_SHARE',
}

export enum PayoutVariableBase {
  GROSS = 'GROSS',
  NET = 'NET',
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  hostex_property_id: string;

  @Column()
  name: string;

  @Column()
  district: string;

  @Column({ type: 'enum', enum: OwnershipType })
  ownership_type: OwnershipType;

  // 월세
  @Column({ type: 'int', default: 0 })
  rent_monthly: number;

  @Column({ type: 'varchar', nullable: true })
  rent_recipient: string | null;

  @Column({ type: 'date', nullable: true })
  rent_contract_start: Date | null;

  @Column({ type: 'date', nullable: true })
  rent_contract_end: Date | null;

  @Column({ type: 'int', default: 0 })
  rent_deposit: number;

  // 위탁/배당
  @Column({ type: 'int', default: 0 })
  payout_fixed_monthly: number;

  @Column({ type: 'int', default: 0 })
  payout_variable_percent: number;

  @Column({ type: 'enum', enum: PayoutVariableBase, default: PayoutVariableBase.GROSS })
  payout_variable_base: PayoutVariableBase;

  // 자가
  @Column({ type: 'int', default: 0 })
  owned_loan_interest: number;

  @Column({ type: 'int', default: 0 })
  owned_depreciation: number;

  @Column({ type: 'int', default: 0 })
  owned_property_tax_annual: number;

  // 공과금
  @Column({ type: 'json', nullable: true })
  utilities: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
