import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';               // ← 추가
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { HostexService } from './services/hostex.service';                    // ← 추가
import { ReservationSyncService } from './services/reservation-sync.service'; // ← 추가

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    HttpModule,                                            // ← 추가
  ],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    HostexService,                                         // ← 추가
    ReservationSyncService,                                // ← 추가
  ],
  exports: [ReservationsService, ReservationSyncService],
})
export class ReservationsModule {}