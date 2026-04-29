import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationSyncService } from './reservations/services/reservation-sync.service';
import { PropertySyncService } from './properties/services/property-sync.service';

@Injectable()
export class SyncScheduleService {
  private readonly logger = new Logger(SyncScheduleService.name);

  constructor(
    private readonly reservationSync: ReservationSyncService,
    private readonly propertySync: PropertySyncService,
  ) {}

  /** 10분마다 예약 동기화 */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncReservations() {
    this.logger.log('⏰ 자동 예약 동기화 시작');
    try {
      const result = await this.reservationSync.syncAll();
      this.logger.log(
        `✅ 예약 동기화 완료: ${result.total}건 (신규 ${result.created}, 업데이트 ${result.updated}, 실패 ${result.failed}) ${result.durationMs}ms`,
      );
    } catch (e) {
      this.logger.error(`❌ 예약 동기화 실패: ${(e as Error).message}`);
    }
  }

  /** 1시간마다 숙소 동기화 */
  @Cron(CronExpression.EVERY_HOUR)
  async syncProperties() {
    this.logger.log('⏰ 자동 숙소 동기화 시작');
    try {
      const result = await this.propertySync.syncAll();
      this.logger.log(`✅ 숙소 동기화 완료: ${JSON.stringify(result)}`);
    } catch (e) {
      this.logger.error(`❌ 숙소 동기화 실패: ${(e as Error).message}`);
    }
  }
}
