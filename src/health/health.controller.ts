import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { HealthService } from './health.service';
import { QueryHealthDto } from './dto/query-health.dto';

@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('portfolio')
  evaluatePortfolio(@Query() query: QueryHealthDto) {
    return this.healthService.evaluatePortfolio(query.period ?? 'this_month');
  }

  @Get('summary')
  getPortfolioSummary(@Query() query: QueryHealthDto) {
    return this.healthService.getPortfolioSummary(query.period ?? 'this_month');
  }

  @Get('properties/:id')
  evaluateProperty(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryHealthDto,
  ) {
    return this.healthService.evaluateSingle(id, query.period ?? 'this_month');
  }
}
