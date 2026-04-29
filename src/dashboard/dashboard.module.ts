import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [ReservationsModule, PropertiesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
