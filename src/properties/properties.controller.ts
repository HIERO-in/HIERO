import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PropertiesService } from './properties.service';
import { PropertySyncService } from './services/property-sync.service';
import { PropertiesExportService } from './services/properties-export.service';
import { PropertiesImportService } from './services/properties-import.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

/**
 * multer의 File 타입이 TS 타입 선언으로 잡히지 않아 수동 정의.
 * (실제 객체는 NestJS FileInterceptor가 multer로 생성)
 */
interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('api/properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly propertySyncService: PropertySyncService,
    private readonly propertiesExportService: PropertiesExportService,
    private readonly propertiesImportService: PropertiesImportService,
  ) {}

  @Post()
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Post('sync')
  async syncFromHostex() {
    return this.propertySyncService.syncAll();
  }

  /**
   * 현재 DB 상태를 XLSX로 다운로드.
   * 98개 숙소 전체 + 활성 계약 + 활성 임대인 정보.
   */
  @Get('export')
  async exportXlsx(@Res() res: Response) {
    const buffer = await this.propertiesExportService.exportAll();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `properties-${today}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }

  /**
   * 빈 템플릿 XLSX 다운로드 (헤더만).
   */
  @Get('template')
  async exportTemplate(@Res() res: Response) {
    const buffer = await this.propertiesExportService.exportTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="properties-template.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }

  /**
   * XLSX 업로드 → DB 일괄 업서트.
   * 매칭: hostex_id 컬럼 기준
   * 빈 셀은 무시 (부분 업데이트)
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importXlsx(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException(
        "파일이 업로드되지 않았습니다. 'file' 필드에 xlsx를 첨부하세요.",
      );
    }
    if (!/\.xlsx?$/i.test(file.originalname)) {
      throw new BadRequestException(
        `.xlsx 파일만 지원됩니다 (받은 파일: ${file.originalname})`,
      );
    }
    return this.propertiesImportService.importFromBuffer(file.buffer);
  }

  @Get()
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.remove(id);
  }
}