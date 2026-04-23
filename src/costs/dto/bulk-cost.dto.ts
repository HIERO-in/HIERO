import { Type } from 'class-transformer';
import { ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { UpsertCostDto } from './upsert-cost.dto';

export class BulkCostDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertCostDto)
  items: UpsertCostDto[];
}
