import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('upload_logs')
export class UploadLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** 업로드한 파일명 */
  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  /** CSV 전체 행 수 */
  @Column({ type: 'int' })
  totalRows: number;

  /** 신규 추가 건수 */
  @Column({ type: 'int' })
  inserted: number;

  /** 중복 건너뜀 건수 */
  @Column({ type: 'int' })
  skipped: number;

  /** 오류 건수 */
  @Column({ type: 'int', default: 0 })
  errorCount: number;

  /** 추가된 거래의 sourceHash 목록 (JSON) — 삭제 시 사용 */
  @Column({ type: 'text', nullable: true })
  insertedHashes: string;

  /** 카테고리별 집계 (JSON) */
  @Column({ type: 'text', nullable: true })
  categoryBreakdown: string;

  /** 삭제 여부 */
  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  @CreateDateColumn()
  uploadedAt: Date;
}
