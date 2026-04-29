import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationNote, NoteKind, IssueStatus } from './entities/reservation-note.entity';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

@Injectable()
export class ReservationNotesService {
  constructor(
    @InjectRepository(ReservationNote)
    private readonly repo: Repository<ReservationNote>,
  ) {}

  async create(dto: CreateNoteDto): Promise<ReservationNote> {
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(query: {
    reservationCode?: string;
    status?: string;
    kind?: string;
  }): Promise<ReservationNote[]> {
    const qb = this.repo.createQueryBuilder('n');
    if (query.reservationCode) qb.andWhere('n.reservationCode = :code', { code: query.reservationCode });
    if (query.status) qb.andWhere('n.status = :status', { status: query.status });
    if (query.kind) qb.andWhere('n.kind = :kind', { kind: query.kind });
    return qb.orderBy('n.createdAt', 'DESC').getMany();
  }

  async findByReservation(code: string): Promise<ReservationNote[]> {
    return this.repo.find({
      where: { reservationCode: code },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: number, dto: UpdateNoteDto): Promise<ReservationNote> {
    const note = await this.repo.findOne({ where: { id } });
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    Object.assign(note, dto);
    return this.repo.save(note);
  }

  async resolve(id: number): Promise<ReservationNote> {
    const note = await this.repo.findOne({ where: { id } });
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    note.status = note.status === IssueStatus.RESOLVED ? IssueStatus.OPEN : IssueStatus.RESOLVED;
    note.resolvedAt = note.status === IssueStatus.RESOLVED ? new Date() : null;
    return this.repo.save(note);
  }

  async remove(id: number): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Note ${id} not found`);
  }

  async getStats(): Promise<{
    openIssues: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const openIssues = await this.repo.count({
      where: { kind: NoteKind.ISSUE, status: IssueStatus.OPEN },
    });

    const catRows = await this.repo
      .createQueryBuilder('n')
      .select('n.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('n.kind = :kind AND n.status != :resolved', {
        kind: NoteKind.ISSUE,
        resolved: IssueStatus.RESOLVED,
      })
      .groupBy('n.category')
      .getRawMany();

    const sevRows = await this.repo
      .createQueryBuilder('n')
      .select('n.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('n.kind = :kind AND n.status != :resolved', {
        kind: NoteKind.ISSUE,
        resolved: IssueStatus.RESOLVED,
      })
      .groupBy('n.severity')
      .getRawMany();

    const byCategory: Record<string, number> = {};
    for (const r of catRows) byCategory[r.category || 'NONE'] = Number(r.count);
    const bySeverity: Record<string, number> = {};
    for (const r of sevRows) bySeverity[r.severity || 'NONE'] = Number(r.count);

    return { openIssues, byCategory, bySeverity };
  }
}
