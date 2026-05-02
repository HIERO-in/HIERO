import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { LaunchStage } from './launch-stage.entity';
import { LaunchStageType } from '../enums/launch-stage.enum';
import { LaunchStatus } from '../enums/launch-status.enum';

@Entity('launches')
export class Launch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Index()
  @Column({ type: 'enum', enum: LaunchStatus, default: LaunchStatus.ACTIVE })
  status: LaunchStatus;

  @Index()
  @Column({
    type: 'enum',
    enum: LaunchStageType,
    default: LaunchStageType.SEARCHING,
  })
  currentStage: LaunchStageType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ownerUserId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  hostexId: string | null;

  @Column({ type: 'json', nullable: true })
  benchmarkHostexIds: string[] | null;

  @Column({ type: 'int', nullable: true })
  expectedRent: number | null;

  @Column({ type: 'int', nullable: true })
  expectedMonthlyRevenue: number | null;

  @Column({ type: 'int', nullable: true })
  area: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  expectedGrade: string | null;

  @Column({ type: 'int', nullable: true })
  buildingYear: number | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @Column({ type: 'timestamp', nullable: true })
  abandonedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  abandonedReason: string | null;

  @OneToMany(() => LaunchStage, (stage) => stage.launch, {
    cascade: true,
  })
  stages: LaunchStage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
