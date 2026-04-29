import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe,
} from '@nestjs/common';
import { ReservationNotesService } from './reservation-notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

@Controller('api/reservation-notes')
export class ReservationNotesController {
  constructor(private readonly service: ReservationNotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('reservationCode') reservationCode?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    return this.service.findAll({ reservationCode, status, kind });
  }

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get('by-reservation/:code')
  findByReservation(@Param('code') code: string) {
    return this.service.findByReservation(code);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.service.resolve(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
