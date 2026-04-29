import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { LaunchesService } from './launches.service';
import { CreateLaunchDto } from './dto/create-launch.dto';
import { UpdateLaunchDto } from './dto/update-launch.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { QueryLaunchDto } from './dto/query-launch.dto';
import { LaunchStageType } from './enums/launch-stage.enum';

@Controller('api/launches')
export class LaunchesController {
  constructor(private readonly launchesService: LaunchesService) {}

  @Post()
  create(@Body() dto: CreateLaunchDto) {
    return this.launchesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryLaunchDto) {
    return this.launchesService.findAll(query);
  }

  @Get('kanban')
  getKanban() {
    return this.launchesService.getKanban();
  }

  @Get('abandoned')
  findAbandoned() {
    return this.launchesService.findAbandoned();
  }

  @Get('overdue')
  findOverdue() {
    return this.launchesService.findOverdueStages();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.launchesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLaunchDto,
  ) {
    return this.launchesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.launchesService.remove(id);
  }

  @Post(':id/advance')
  advance(@Param('id', ParseIntPipe) id: number) {
    return this.launchesService.advanceStage(id);
  }

  @Post(':id/abandon')
  abandon(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.launchesService.abandon(id, reason);
  }

  @Patch(':id/stages/:stage')
  updateStage(
    @Param('id', ParseIntPipe) id: number,
    @Param('stage') stage: LaunchStageType,
    @Body() dto: UpdateStageDto,
  ) {
    return this.launchesService.updateStage(id, stage, dto);
  }
}
