import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaunchesService } from './launches.service';
import { LaunchesController } from './launches.controller';
import { Launch } from './entities/launch.entity';
import { LaunchStage } from './entities/launch-stage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Launch, LaunchStage])],
  controllers: [LaunchesController],
  providers: [LaunchesService],
  exports: [LaunchesService],
})
export class LaunchesModule {}
