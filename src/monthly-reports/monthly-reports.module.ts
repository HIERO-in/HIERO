// ———————————————————————————————————————————
// HIERO · 월별 리포트 NestJS 모듈
// ———————————————————————————————————————————

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyReport } from './entities/monthly-report.entity.js';
import { MonthlyReportProperty } from './entities/monthly-report-property.entity.js';
import { MonthlyReportReservation } from './entities/monthly-report-reservation.entity.js';
import { MonthlyReportsController } from './monthly-reports.controller.js';
import { MonthlyReportsService } from './services/monthly-reports.service.js';
import { MonthlyReportParserService } from './services/monthly-report-parser.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonthlyReport,
      MonthlyReportProperty,
      MonthlyReportReservation,
    ]),
  ],
  controllers: [MonthlyReportsController],
  providers: [MonthlyReportsService, MonthlyReportParserService],
  exports: [MonthlyReportsService],
})
export class MonthlyReportsModule {}
