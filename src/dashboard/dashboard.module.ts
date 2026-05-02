import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { PropertiesModule } from '../properties/properties.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [ReservationsModule, PropertiesModule, TransactionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
