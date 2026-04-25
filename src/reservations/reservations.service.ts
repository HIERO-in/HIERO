import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';
import { calculateRevenueDate } from './utils/revenue-date.util';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
  ) {}

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const revenueDate = calculateRevenueDate({
      channelType: dto.channelType,
      customChannelName: dto.customChannelName,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      bookedAt: dto.bookedAt,
    });

    const nights = dto.nights ?? this.calculateNights(dto.checkInDate, dto.checkOutDate);

    const existing = await this.reservationRepo.findOne({
      where: { reservationCode: dto.reservationCode },
    });

    if (existing) {
      Object.assign(existing, dto, { revenueDate, nights });
      return this.reservationRepo.save(existing);
    }

    const reservation = this.reservationRepo.create({
      ...dto,
      revenueDate,
      nights,
    });
    return this.reservationRepo.save(reservation);
  }

  async findAll(query: QueryReservationDto): Promise<Reservation[]> {
    const qb = this.reservationRepo.createQueryBuilder('r');

    if (query.from && query.to) {
      qb.andWhere('r.checkInDate <= :to AND r.checkOutDate >= :from', {
        from: query.from,
        to: query.to,
      });
    }

    if (query.propertyId) {
      qb.andWhere('r.propertyId = :propertyId', { propertyId: query.propertyId });
    }

    if (query.channelType) {
      qb.andWhere('r.channelType = :channelType', { channelType: query.channelType });
    }

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.stayStatus) {
      qb.andWhere('r.stayStatus = :stayStatus', { stayStatus: query.stayStatus });
    }

    return qb
      .orderBy('r.propertyId', 'ASC')
      .addOrderBy('r.checkInDate', 'ASC')
      .getMany();
  }

  async findByDateRange(from: string, to: string): Promise<Reservation[]> {
    return this.reservationRepo
      .createQueryBuilder('r')
      .where('r.checkInDate <= :to AND r.checkOutDate >= :from', { from, to })
      .andWhere('r.status != :cancelled', { cancelled: 'cancelled' })
      .orderBy('r.propertyId', 'ASC')
      .addOrderBy('r.checkInDate', 'ASC')
      .getMany();
  }

  async findByProperty(
    propertyId: number,
    from?: string,
    to?: string,
  ): Promise<Reservation[]> {
    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId });

    if (from && to) {
      qb.andWhere('r.checkInDate <= :to AND r.checkOutDate >= :from', { from, to });
    }

    return qb.orderBy('r.checkInDate', 'ASC').getMany();
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    return reservation;
  }

  async findByCode(reservationCode: string): Promise<Reservation | null> {
    return this.reservationRepo.findOne({ where: { reservationCode } });
  }

  async update(id: number, dto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);
    Object.assign(reservation, dto);

    if (dto.checkInDate || dto.checkOutDate || dto.channelType || dto.customChannelName) {
      reservation.revenueDate = calculateRevenueDate({
        channelType: reservation.channelType,
        customChannelName: reservation.customChannelName,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        bookedAt: reservation.bookedAt,
      });
    }

    if (dto.checkInDate || dto.checkOutDate) {
      reservation.nights = this.calculateNights(
        reservation.checkInDate,
        reservation.checkOutDate,
      );
    }

    return this.reservationRepo.save(reservation);
  }

  async remove(id: number): Promise<void> {
    const result = await this.reservationRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const diff = outDate.getTime() - inDate.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}