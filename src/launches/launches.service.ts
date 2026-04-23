import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Launch } from './entities/launch.entity';
import { LaunchStage } from './entities/launch-stage.entity';
import {
  LaunchStageType,
  LAUNCH_STAGES_IN_ORDER,
  LAUNCH_STAGE_ORDER,
} from './enums/launch-stage.enum';
import { LaunchStatus } from './enums/launch-status.enum';
import { CreateLaunchDto } from './dto/create-launch.dto';
import { UpdateLaunchDto } from './dto/update-launch.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { QueryLaunchDto } from './dto/query-launch.dto';

@Injectable()
export class LaunchesService {
  constructor(
    @InjectRepository(Launch)
    private readonly launchRepo: Repository<Launch>,
    @InjectRepository(LaunchStage)
    private readonly stageRepo: Repository<LaunchStage>,
    private readonly dataSource: DataSource,
  ) {}

  // Launch 생성 시 8개 LaunchStage 자동 생성
  async create(dto: CreateLaunchDto): Promise<Launch> {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const launch = manager.create(Launch, {
        ...dto,
        status: LaunchStatus.ACTIVE,
        currentStage: LaunchStageType.SEARCHING,
      });
      const savedLaunch = await manager.save(launch);

      const stages = LAUNCH_STAGES_IN_ORDER.map((stage) =>
        manager.create(LaunchStage, {
          launchId: savedLaunch.id,
          stage,
          stageOrder: LAUNCH_STAGE_ORDER[stage],
        }),
      );
      await manager.save(stages);

      return savedLaunch.id;
    });

    return this.findOne(savedId);
  }
  

  async findAll(query: QueryLaunchDto): Promise<Launch[]> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.currentStage) where.currentStage = query.currentStage;
    if (query.ownerUserId) where.ownerUserId = query.ownerUserId;

    return this.launchRepo.find({
      where,
      relations: ['stages'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Launch> {
    const launch = await this.launchRepo.findOne({
      where: { id },
      relations: ['stages'],
    });
    if (!launch) throw new NotFoundException(`Launch ${id} not found`);

    // stageOrder 순으로 정렬
    launch.stages.sort((a, b) => a.stageOrder - b.stageOrder);
    return launch;
  }

  async update(id: number, dto: UpdateLaunchDto): Promise<Launch> {
    const launch = await this.findOne(id);

    // ABANDONED 전환 시 abandonedAt 자동 기록
    if (
      dto.status === LaunchStatus.ABANDONED &&
      launch.status !== LaunchStatus.ABANDONED
    ) {
      launch.abandonedAt = new Date();
    }

    Object.assign(launch, dto);
    await this.launchRepo.save(launch);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const launch = await this.findOne(id);
    await this.launchRepo.remove(launch);
  }

  // 특정 단계 정보 업데이트 (완료 처리, 데드라인 설정 등)
  async updateStage(
    launchId: number,
    stage: LaunchStageType,
    dto: UpdateStageDto,
  ): Promise<LaunchStage> {
    const stageRow = await this.stageRepo.findOne({
      where: { launchId, stage },
    });
    if (!stageRow) {
      throw new NotFoundException(
        `Stage ${stage} not found for launch ${launchId}`,
      );
    }

    if (dto.targetDate !== undefined) {
      stageRow.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    }
    if (dto.completedAt !== undefined) {
      stageRow.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    }
    if (dto.completedBy !== undefined) {
      stageRow.completedBy = dto.completedBy ?? null;
    }
    if (dto.memo !== undefined) {
      stageRow.memo = dto.memo ?? null;
    }

    return this.stageRepo.save(stageRow);
  }

  // 현재 단계를 다음 단계로 진행 (Q18: 건너뛰기 허용이지만 편의용)
  async advanceStage(launchId: number): Promise<Launch> {
    const launch = await this.findOne(launchId);
    const currentOrder = LAUNCH_STAGE_ORDER[launch.currentStage];
    if (currentOrder >= 8) {
      throw new BadRequestException('Already at final stage (LIVE)');
    }
    const nextStage = LAUNCH_STAGES_IN_ORDER[currentOrder]; // 0-indexed, next
    launch.currentStage = nextStage;

    if (nextStage === LaunchStageType.LIVE) {
      launch.status = LaunchStatus.LIVE;
    }

    await this.launchRepo.save(launch);
    return this.findOne(launchId);
  }

  // 데드라인 지난 미완료 단계 조회
  async findOverdueStages(): Promise<LaunchStage[]> {
    return this.stageRepo
      .createQueryBuilder('stage')
      .leftJoinAndSelect('stage.launch', 'launch')
      .where('stage.completedAt IS NULL')
      .andWhere('stage.targetDate IS NOT NULL')
      .andWhere('stage.targetDate < CURDATE()')
      .andWhere('launch.status = :status', { status: LaunchStatus.ACTIVE })
      .orderBy('stage.targetDate', 'ASC')
      .getMany();
  }
}
