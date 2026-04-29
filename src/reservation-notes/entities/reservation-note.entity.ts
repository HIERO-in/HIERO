import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum NoteKind { ISSUE = 'ISSUE', NOTE = 'NOTE', TAG = 'TAG' }
export enum IssueSeverity { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
export enum IssueStatus { OPEN = 'OPEN', IN_PROGRESS = 'IN_PROGRESS', RESOLVED = 'RESOLVED' }
export enum IssueCategory {
  UNPAID = 'UNPAID', COMPLAINT = 'COMPLAINT', CLEANING = 'CLEANING',
  KEY = 'KEY', EXTENSION = 'EXTENSION', REFUND = 'REFUND', OTHER = 'OTHER',
}

@Entity('reservation_notes')
export class ReservationNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 200 })
  reservationCode: string;

  @Column({ type: 'enum', enum: NoteKind })
  kind: NoteKind;

  @Column({ type: 'enum', enum: IssueCategory, nullable: true })
  category: IssueCategory | null;

  @Column({ type: 'enum', enum: IssueSeverity, nullable: true })
  severity: IssueSeverity | null;

  @Index()
  @Column({ type: 'enum', enum: IssueStatus, default: IssueStatus.OPEN })
  status: IssueStatus;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 50, default: 'heiro' })
  authorId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  assigneeId: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
