// ———————————————————————————————————————————
// HIERO · 월별 리포트 컨트롤러
// REST API:
//   GET    /api/monthly-reports                          → 월 목록 (요약)
//   GET    /api/monthly-reports/summary                  → 카테고리 합계
//   GET    /api/monthly-reports/property-names           → 모든 호실명
//   GET    /api/monthly-reports/properties/:name         → 호실 시계열
//   GET    /api/monthly-reports/properties/:name/avg     → 호실 평균 (recent N)
//   GET    /api/monthly-reports/:month                   → 월 상세 (호실+예약)
//   POST   /api/monthly-reports/import (multipart files) → 여러 CSV 업로드
//   DELETE /api/monthly-reports/:month                   → 월 삭제
// ———————————————————————————————————————————

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MonthlyReportsService } from './services/monthly-reports.service.js';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('api/monthly-reports')
export class MonthlyReportsController {
  constructor(private readonly service: MonthlyReportsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('summary')
  async summary(@Query('months') months?: string) {
    const arr = months ? months.split(',').filter(Boolean) : undefined;
    return this.service.getCategoryTotals(arr);
  }

  @Get('property-names')
  propertyNames() {
    return this.service.getAllPropertyNames();
  }

  @Get('properties/:name')
  history(@Param('name') name: string) {
    return this.service.getPropertyHistory(decodeURIComponent(name));
  }

  @Get('properties/:name/avg')
  average(
    @Param('name') name: string,
    @Query('months') months?: string,
  ) {
    const recent = months ? Number(months) : 12;
    return this.service.getPropertyAverage(decodeURIComponent(name), recent);
  }

  @Get(':month')
  getMonth(@Param('month') month: string) {
    return this.service.getMonth(month);
  }

  @Delete(':month')
  remove(@Param('month') month: string) {
    return this.service.deleteMonth(month);
  }

  /**
   * 멀티파트 CSV 업로드 (1개 또는 여러 개).
   * field 이름: "files"  (배열)
   * 한 번에 여러 월 가능 — 파일명에서 자동 그룹핑.
   */
  @Post('import')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB/파일
    }),
  )
  async importCsv(@UploadedFiles() files: MulterFile[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        "파일이 업로드되지 않았습니다. 'files' 필드에 CSV를 첨부하세요.",
      );
    }
    const csvFiles = files.filter((f) => /\.csv$/i.test(f.originalname));
    if (csvFiles.length === 0) {
      throw new BadRequestException(
        '.csv 파일이 없습니다.',
      );
    }
    return this.service.importFromFiles(
      csvFiles.map((f) => ({
        originalname: f.originalname,
        buffer: f.buffer,
      })),
    );
  }
}
