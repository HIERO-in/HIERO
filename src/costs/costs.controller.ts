import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { CostsService } from './costs.service';
import { UpsertCostDto } from './dto/upsert-cost.dto';
import { BulkCostDto } from './dto/bulk-cost.dto';

@Controller('api/costs')
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  // 전체 목록
  @Get()
  findAll() {
    return this.costsService.findAll();
  }

  // 특정 숙소 비용 조회
  @Get(':hostexId')
  findOne(@Param('hostexId') hostexId: string) {
    return this.costsService.findByHostexId(hostexId);
  }

  // 단건 upsert (생성/수정 동일)
  @Post()
  upsert(@Body() dto: UpsertCostDto) {
    return this.costsService.upsert(dto);
  }

  // 일괄 upsert
  @Post('bulk')
  bulkUpsert(@Body() dto: BulkCostDto) {
    return this.costsService.bulkUpsert(dto);
  }

  // 삭제
  @Delete(':hostexId')
  remove(@Param('hostexId') hostexId: string) {
    return this.costsService.remove(hostexId);
  }
}
