import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsService } from './services/transactions.service';

interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

@Controller('api/hostex-transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  /** CSV 업로드 → DB import (dedupe + 호실 매칭 자동) */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException("'file' 필드에 CSV를 첨부하세요.");
    }
    const text = file.buffer.toString('utf8');
    return this.service.importFromCsv(text);
  }

  /** 전체 통계 + 연도/종류별 집계 */
  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  /** 기간별 비용 요약 (체크인 날짜 기준) */
  @Get('summary')
  summary(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from, to 파라미터 필수 (YYYY-MM-DD)');
    }
    return this.service.getExpenseSummary(from, to);
  }

  /** 예약별 거래 내역 */
  @Get('by-reservation/:code')
  byReservation(@Param('code') code: string) {
    return this.service.findByReservationCode(code);
  }

  /** 호실별 거래 + 예약별 P&L */
  @Get('by-property/:title')
  byProperty(
    @Param('title') title: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getPropertyFinancials(decodeURIComponent(title), from, to);
  }

  /** 전체 삭제 (재import용) */
  @Delete()
  deleteAll() {
    return this.service.deleteAll();
  }
}
