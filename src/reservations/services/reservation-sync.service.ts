import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from '../entities/reservation.entity';
import { HostexService } from './hostex.service';
import { HostexReservation } from '../types/hostex.types';
import { calculateRevenueDate } from '../utils/revenue-date.util';

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

@Injectable()
export class ReservationSyncService {
  private readonly logger = new Logger(ReservationSyncService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly hostexService: HostexService,
  ) {}

  // 전체 동기화
  async syncAll(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      durationMs: 0,
      errors: [],
    };

    try {
      this.logger.log('=== Hostex 동기화 시작 ===');

      // 1. Hostex에서 전체 예약 가져오기
      const hostexReservations = await this.hostexService.fetchAllReservations();
      result.total = hostexReservations.length;

      this.logger.log(`Fetched ${result.total} reservations from Hostex`);

      // 2. 각 예약을 DB에 저장 (upsert)
      for (const hx of hostexReservations) {
        try {
          const saved = await this.upsertReservation(hx);
          if (saved.isNew) {
            result.created++;
          } else {
            result.updated++;
          }
        } catch (error: any) {
          result.failed++;
          const errMsg = `${hx.reservation_code}: ${error.message}`;
          result.errors.push(errMsg);
          this.logger.error(errMsg);
        }
      }

      result.durationMs = Date.now() - startTime;
      this.logger.log(
        `=== 동기화 완료: 생성 ${result.created}, 업데이트 ${result.updated}, 실패 ${result.failed} (${result.durationMs}ms) ===`,
      );

      return result;
    } catch (error: any) {
      result.durationMs = Date.now() - startTime;
      result.errors.push(`Sync failed: ${error.message}`);
      this.logger.error(`동기화 실패: ${error.message}`);
      throw error;
    }
  }

  // 개별 예약 upsert
  private async upsertReservation(
    hx: HostexReservation,
  ): Promise<{ reservation: Reservation; isNew: boolean }> {
    const existing = await this.reservationRepo.findOne({
      where: { reservationCode: hx.reservation_code },
    });

    const mapped = this.mapHostexToEntity(hx);

    if (existing) {
      // 기존 예약 업데이트
      Object.assign(existing, mapped);
      const saved = await this.reservationRepo.save(existing);
      return { reservation: saved, isNew: false };
    } else {
      // 새 예약 생성
      const created = this.reservationRepo.create(mapped);
      const saved = await this.reservationRepo.save(created);
      return { reservation: saved, isNew: true };
    }
  }

  // Hostex → Entity 변환
  private mapHostexToEntity(hx: HostexReservation): Partial<Reservation> {
    const nights = this.calculateNights(hx.check_in_date, hx.check_out_date);

    const bookedAt = hx.booked_at ? new Date(hx.booked_at) : undefined;

    const revenueDate = calculateRevenueDate({
      channelType: hx.channel_type,
      customChannelName: hx.custom_channel?.name,
      checkInDate: hx.check_in_date,
      checkOutDate: hx.check_out_date,
      bookedAt,
    });

    return {
      reservationCode: hx.reservation_code,
      stayCode: hx.stay_code,
      channelId: hx.channel_id,

      propertyId: hx.property_id,
      listingId: hx.listing_id,

      channelType: hx.channel_type,
      customChannelId: hx.custom_channel?.id,
      customChannelName: hx.custom_channel?.name,

      checkInDate: hx.check_in_date,
      checkOutDate: hx.check_out_date,
      nights,
      bookedAt,
      cancelledAt: hx.cancelled_at ? new Date(hx.cancelled_at) : undefined,
      revenueDate,

      guestName: hx.guest_name || undefined,
      guestPhone: hx.guest_phone || undefined,
      guestEmail: hx.guest_email || undefined,
      numberOfGuests: hx.number_of_guests,
      numberOfAdults: hx.number_of_adults,
      numberOfChildren: hx.number_of_children,
      numberOfInfants: hx.number_of_infants,
      numberOfPets: hx.number_of_pets,

      currency: hx.rates?.total_rate?.currency || 'KRW',
      totalRate: hx.rates?.total_rate?.amount || 0,
      totalCommission: hx.rates?.total_commission?.amount || 0,

      status: hx.status,
      stayStatus: hx.stay_status,

      remarks: hx.remarks || undefined,
      channelRemarks: hx.channel_remarks || undefined,
      tags: hx.tags || [],
      inReservationBox: hx.in_reservation_box,

      rawData: hx,  // 전체 원본 저장 (디버깅/재처리용)
    };
  }

  // 박수 계산
  private calculateNights(checkIn: string, checkOut: string): number {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    const diff = outDate.getTime() - inDate.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}