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
import { Launch } from './launch.entity';
import { LaunchStageType } from '../enums/launch-stage.enum';

@Entity('launch_stages')
@Index(['launchId', 'stage'], { unique: true })
export class LaunchStage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  launchId: number;

  @ManyToOne(() => Launch, (launch) => launch.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'launchId' })
  launch: Launch;

  @Column({ type: 'enum', enum: LaunchStageType })
  stage: LaunchStageType;

  @Column({ type: 'tinyint', unsigned: true })
  stageOrder: number;

  @Column({ type: 'date', nullable: true })
  targetDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  completedBy: string | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
