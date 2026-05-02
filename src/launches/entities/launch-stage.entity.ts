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

  /** 이 단계 목표일 */
  @Column({ type: 'date', nullable: true })
  targetDate: Date | null;

  /** 이 단계 진입일 (실제 시작) */
  @Column({ type: 'timestamp', nullable: true })
  enteredAt: Date | null;

  /** 이 단계 완료일 */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /** 완료 처리한 사람 (레거시) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  completedBy: string | null;

  /** 담당자 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  assignee: string | null;

  /** 이슈/문제 사항 */
  @Column({ type: 'text', nullable: true })
  issue: string | null;

  /** 이 단계 발생 비용 (원) */
  @Column({ type: 'int', default: 0 })
  cost: number;

  /** 첨부 파일 URL 목록 (사진 등) */
  @Column({ type: 'json', nullable: true })
  attachments: string[] | null;

  /** 단계별 다른 입력 데이터 (JSON) */
  @Column({ type: 'json', nullable: true })
  details: Record<string, any> | null;

  /** 메모 */
  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
