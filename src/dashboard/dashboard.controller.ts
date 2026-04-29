import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('sales-analytics')
  getSalesAnalytics(@Query('period') period?: string) {
    return this.service.getSalesAnalytics(period ?? 'this_month');
  }
}
