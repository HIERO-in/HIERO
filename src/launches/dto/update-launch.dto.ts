import { PartialType } from '@nestjs/mapped-types';
import { CreateLaunchDto } from './create-launch.dto';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { LaunchStageType } from '../enums/launch-stage.enum';
import { LaunchStatus } from '../enums/launch-status.enum';

export class UpdateLaunchDto extends PartialType(CreateLaunchDto) {
  @IsOptional()
  @IsEnum(LaunchStatus)
  status?: LaunchStatus;

  @IsOptional()
  @IsEnum(LaunchStageType)
  currentStage?: LaunchStageType;

  @IsOptional()
  @IsString()
  hostexId?: string;

  @IsOptional()
  @IsString()
  abandonedReason?: string;
}
