import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { CostsModule } from '../costs/costs.module';
import { MonthlyReportsModule } from '../monthly-reports/monthly-reports.module';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PropertiesModule,
    ReservationsModule,
    CostsModule,
    MonthlyReportsModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
