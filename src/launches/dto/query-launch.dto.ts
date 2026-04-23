import { IsOptional, IsEnum, IsString } from 'class-validator';
import { LaunchStageType } from '../enums/launch-stage.enum';
import { LaunchStatus } from '../enums/launch-status.enum';

export class QueryLaunchDto {
  @IsOptional()
  @IsEnum(LaunchStatus)
  status?: LaunchStatus;

  @IsOptional()
  @IsEnum(LaunchStageType)
  currentStage?: LaunchStageType;

  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
