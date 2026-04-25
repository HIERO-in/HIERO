import { IsOptional, IsString } from 'class-validator';

export class QueryHealthDto {
  @IsOptional()
  @IsString()
  period?: string; // '7d' | '14d' | '30d' | '90d' | 'this_month' | 'last_month'
}
