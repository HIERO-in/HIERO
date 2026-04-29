import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationNote } from './entities/reservation-note.entity';
import { ReservationNotesService } from './reservation-notes.service';
import { ReservationNotesController } from './reservation-notes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReservationNote])],
  controllers: [ReservationNotesController],
  providers: [ReservationNotesService],
  exports: [ReservationNotesService],
})
export class ReservationNotesModule {}
