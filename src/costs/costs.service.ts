import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cost } from './entities/cost.entity';
import { UpsertCostDto } from './dto/upsert-cost.dto';
import { BulkCostDto } from './dto/bulk-cost.dto';
import {
  UTILITY_KEYS,
  UtilityMode,
  UtilitiesMap,
} from './enums/owner-type.enum';

@Injectable()
export class CostsService {
  constructor(
    @InjectRepository(Cost)
    private readonly costRepo: Repository<Cost>,
  ) {}

  /** 프론트 getDefaultPropertyCost()의 utilities와 동일한 기본값 생성 */
  private getDefaultUtilities(): UtilitiesMap {
    const defaults: Record<string, { mode: UtilityMode; amount: number }> = {
      management_fee: { mode: UtilityMode.FIXED, amount: 0 },
      internet: { mode: UtilityMode.FIXED, amount: 0 },
      electric: { mode: UtilityMode.VARIABLE, amount: 0 },
      gas: { mode: UtilityMode.FIXED, amount: 0 },
      water: { mode: UtilityMode.VARIABLE, amount: 0 },
      insurance: { mode: UtilityMode.FIXED, amount: 0 },
      other_utility: { mode: UtilityMode.FIXED, amount: 0 },
    };
    return defaults as UtilitiesMap;
  }

  /** 단건 upsert (hostexId 기준) */
  async upsert(dto: UpsertCostDto): Promise<Cost> {
    const existing = await this.costRepo.findOne({
      where: { hostexId: dto.hostexId },
    });

    if (existing) {
      // 부분 업데이트. utilities는 dto에서 명시한 경우에만 덮어씀
      Object.assign(existing, dto);
      return this.costRepo.save(existing);
    }

    // 신규 생성: utilities 안 주면 기본값 채움
    const newCost = this.costRepo.create({
      ...dto,
      utilities: dto.utilities ?? this.getDefaultUtilities(),
    });
    return this.costRepo.save(newCost);
  }

  /** 여러 숙소 일괄 upsert */
  async bulkUpsert(dto: BulkCostDto): Promise<Cost[]> {
    const results: Cost[] = [];
    for (const item of dto.items) {
      results.push(await this.upsert(item));
    }
    return results;
  }

  async findAll(): Promise<Cost[]> {
    return this.costRepo.find({ order: { hostexId: 'ASC' } });
  }

  async findByHostexId(hostexId: string): Promise<Cost> {
    const cost = await this.costRepo.findOne({ where: { hostexId } });
    if (!cost) {
      throw new NotFoundException(`Cost for hostexId ${hostexId} not found`);
    }
    return cost;
  }

  /** 여러 숙소 한 번에 조회 (KPI 계산 시 유용) */
  async findManyByHostexIds(hostexIds: string[]): Promise<Cost[]> {
    if (hostexIds.length === 0) return [];
    return this.costRepo.find({ where: { hostexId: In(hostexIds) } });
  }

  async remove(hostexId: string): Promise<void> {
    const cost = await this.findByHostexId(hostexId);
    await this.costRepo.remove(cost);
  }
}
