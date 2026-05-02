import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';
import { ReservationSyncService } from './services/reservation-sync.service'; // ← 추가

@Controller('api/reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly syncService: ReservationSyncService,      // ← 추가
  ) {}

  // ─── 동기화 엔드포인트 (추가) ───
  @Post('sync')
  async sync() {
    return this.syncService.syncAll();
  }

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryReservationDto) {
    if (query.page || query.limit) {
      return this.reservationsService.findAllPaginated(query);
    }
    return this.reservationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.remove(id);
  }
}