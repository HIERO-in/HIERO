import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { CostsModule } from '../costs/costs.module';
import { MonthlyReportsModule } from '../monthly-reports/monthly-reports.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostexTransaction } from '../transactions/entities/hostex-transaction.entity';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PropertiesModule,
    ReservationsModule,
    CostsModule,
    MonthlyReportsModule,
    TransactionsModule,
    TypeOrmModule.forFeature([HostexTransaction]),
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
