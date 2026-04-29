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
  LAUNCH_STAGE_LABELS,
} from './enums/launch-stage.enum';
import { LaunchStatus } from './enums/launch-status.enum';
import { CreateLaunchDto } from './dto/create-launch.dto';
import { UpdateLaunchDto } from './dto/update-launch.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { QueryLaunchDto } from './dto/query-launch.dto';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class LaunchesService {
  constructor(
    @InjectRepository(Launch)
    private readonly launchRepo: Repository<Launch>,
    @InjectRepository(LaunchStage)
    private readonly stageRepo: Repository<LaunchStage>,
    private readonly dataSource: DataSource,
    private readonly propertiesService: PropertiesService,
  ) {}

  // Launch 생성 시 8개 LaunchStage 자동 생성 + searching 단계 시작 기록
  async create(dto: CreateLaunchDto): Promise<Launch> {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const launch = manager.create(Launch, {
        ...dto,
        status: LaunchStatus.ACTIVE,
        currentStage: LaunchStageType.SEARCHING,
      });
      const savedLaunch = await manager.save(launch);

      const now = new Date();
      const stages = LAUNCH_STAGES_IN_ORDER.map((stage) =>
        manager.create(LaunchStage, {
          launchId: savedLaunch.id,
          stage,
          stageOrder: LAUNCH_STAGE_ORDER[stage],
          enteredAt: stage === LaunchStageType.SEARCHING ? now : null,
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

    if (dto.targetDate !== undefined) stageRow.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    if (dto.enteredAt !== undefined) stageRow.enteredAt = dto.enteredAt ? new Date(dto.enteredAt) : null;
    if (dto.completedAt !== undefined) stageRow.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    if (dto.completedBy !== undefined) stageRow.completedBy = dto.completedBy ?? null;
    if (dto.assignee !== undefined) stageRow.assignee = dto.assignee ?? null;
    if (dto.issue !== undefined) stageRow.issue = dto.issue ?? null;
    if (dto.cost !== undefined) stageRow.cost = dto.cost ?? 0;
    if (dto.attachments !== undefined) stageRow.attachments = dto.attachments ?? null;
    if (dto.memo !== undefined) stageRow.memo = dto.memo ?? null;

    return this.stageRepo.save(stageRow);
  }

  // 현재 단계를 다음 단계로 진행 — 이전 단계 자동 완료 처리
  async advanceStage(launchId: number): Promise<Launch> {
    const launch = await this.findOne(launchId);
    const currentOrder = LAUNCH_STAGE_ORDER[launch.currentStage];
    if (currentOrder >= 8) {
      throw new BadRequestException('Already at final stage (LIVE)');
    }

    // 현재 단계 completedAt 자동 기록
    const currentStageRow = launch.stages.find(
      (s) => s.stage === launch.currentStage,
    );
    if (currentStageRow && !currentStageRow.completedAt) {
      currentStageRow.completedAt = new Date();
      await this.stageRepo.save(currentStageRow);
    }

    const nextStage = LAUNCH_STAGES_IN_ORDER[currentOrder]; // 0-indexed, next
    launch.currentStage = nextStage;

    // 다음 단계 enteredAt 자동 기록
    const nextStageRow = launch.stages.find((s) => s.stage === nextStage);
    if (nextStageRow && !nextStageRow.enteredAt) {
      nextStageRow.enteredAt = new Date();
      await this.stageRepo.save(nextStageRow);
    }

    if (nextStage === LaunchStageType.LIVE) {
      launch.status = LaunchStatus.LIVE;
      // LIVE 단계도 자동 완료 처리
      const liveStageRow = launch.stages.find(
        (s) => s.stage === LaunchStageType.LIVE,
      );
      if (liveStageRow && !liveStageRow.completedAt) {
        liveStageRow.completedAt = new Date();
        await this.stageRepo.save(liveStageRow);
      }
    }

    await this.launchRepo.save(launch);
    return this.findOne(launchId);
  }

  // 포기 처리
  async abandon(
    id: number,
    reason?: string,
  ): Promise<Launch> {
    const launch = await this.findOne(id);
    if (launch.status === LaunchStatus.ABANDONED) {
      throw new BadRequestException('Already abandoned');
    }
    if (launch.status === LaunchStatus.LIVE) {
      throw new BadRequestException('LIVE 상태는 포기할 수 없습니다');
    }
    launch.status = LaunchStatus.ABANDONED;
    launch.abandonedAt = new Date();
    launch.abandonedReason = reason ?? null;
    await this.launchRepo.save(launch);
    return this.findOne(id);
  }

  // 칸반보드용: 단계별 그룹핑 + daysInStage 계산
  async getKanban(): Promise<{
    columns: {
      stage: LaunchStageType;
      label: string;
      order: number;
      cards: any[];
    }[];
    totalActive: number;
    totalAbandoned: number;
  }> {
    const [activeLaunches, abandonedCount] = await Promise.all([
      this.launchRepo.find({
        where: [
          { status: LaunchStatus.ACTIVE },
          { status: LaunchStatus.LIVE },
        ],
        relations: ['stages'],
        order: { createdAt: 'ASC' },
      }),
      this.launchRepo.count({ where: { status: LaunchStatus.ABANDONED } }),
    ]);

    const now = new Date();
    const columns = LAUNCH_STAGES_IN_ORDER.map((stage) => {
      const cards = activeLaunches
        .filter((l) => l.currentStage === stage)
        .map((l) => {
          // 현재 단계 진입일 = 이전 단계 completedAt, 또는 launch.createdAt (첫 단계)
          const currentStageRow = l.stages.find((s) => s.stage === stage);
          const prevOrder = LAUNCH_STAGE_ORDER[stage] - 1;
          const prevStageRow = prevOrder > 0
            ? l.stages.find((s) => s.stageOrder === prevOrder)
            : null;

          const enteredAt = prevStageRow?.completedAt || l.createdAt;
          const daysInStage = Math.floor(
            (now.getTime() - new Date(enteredAt).getTime()) / (24 * 60 * 60 * 1000),
          );

          return {
            id: l.id,
            name: l.name,
            address: l.address,
            status: l.status,
            expectedRent: l.expectedRent,
            expectedMonthlyRevenue: l.expectedMonthlyRevenue,
            area: l.area,
            memo: l.memo,
            hostexId: l.hostexId,
            daysInStage,
            isOverdue: daysInStage >= 7,
            enteredAt,
            stages: l.stages.sort((a, b) => a.stageOrder - b.stageOrder),
          };
        });

      return {
        stage,
        label: LAUNCH_STAGE_LABELS[stage],
        order: LAUNCH_STAGE_ORDER[stage],
        cards,
      };
    });

    return {
      columns,
      totalActive: activeLaunches.length,
      totalAbandoned: abandonedCount,
    };
  }

  // 포기된 런칭 목록 (포기됨 탭용)
  async findAbandoned(): Promise<Launch[]> {
    return this.launchRepo.find({
      where: { status: LaunchStatus.ABANDONED },
      relations: ['stages'],
      order: { abandonedAt: 'DESC' },
    });
  }

  /** 런칭 1건의 비용/진행 요약 */
  async getSummary(id: number) {
    const launch = await this.findOne(id);
    const totalCost = launch.stages.reduce((s, st) => s + (st.cost || 0), 0);
    const completedStages = launch.stages.filter((s) => s.completedAt).length;
    const currentStageRow = launch.stages.find((s) => s.stage === launch.currentStage);

    // 단계별 소요일
    const stageDurations = launch.stages
      .filter((s) => s.enteredAt && s.completedAt)
      .map((s) => ({
        stage: s.stage,
        days: Math.round((new Date(s.completedAt!).getTime() - new Date(s.enteredAt!).getTime()) / 86400000),
        cost: s.cost || 0,
      }));

    // 전체 소요일 (첫 진입 ~ 현재)
    const firstEntry = launch.stages.find((s) => s.enteredAt);
    const totalDays = firstEntry
      ? Math.round((Date.now() - new Date(firstEntry.enteredAt!).getTime()) / 86400000)
      : 0;

    return {
      launchId: id,
      name: launch.name,
      status: launch.status,
      currentStage: launch.currentStage,
      progress: `${completedStages}/8`,
      totalCost,
      totalDays,
      stageDurations,
      issues: launch.stages.filter((s) => s.issue).map((s) => ({
        stage: s.stage,
        issue: s.issue,
        assignee: s.assignee,
      })),
    };
  }

  /**
   * LIVE 런칭을 Properties에 연결.
   * hostexId를 입력하면 Launch에 기록하고,
   * 해당 hostexId의 Property가 이미 있으면 연결 확인만,
   * 없으면 기본 정보로 Property 생성.
   */
  async linkToProperty(
    launchId: number,
    hostexId: string,
  ): Promise<{ launch: Launch; propertyId: number; created: boolean }> {
    const launch = await this.findOne(launchId);
    if (launch.status !== LaunchStatus.LIVE) {
      throw new BadRequestException('LIVE 상태의 런칭만 Properties에 연결할 수 있습니다');
    }

    // Launch에 hostexId 기록
    launch.hostexId = hostexId;
    await this.launchRepo.save(launch);

    // Property 조회 or 생성
    const allProps = await this.propertiesService.findAll();
    const existing = allProps.find((p: any) => String(p.hostexId) === hostexId);

    if (existing) {
      return { launch: await this.findOne(launchId), propertyId: existing.id, created: false };
    }

    // 새 Property 생성 (기본 정보만 — Hostex sync 시 나머지 채워짐)
    const newProp = await this.propertiesService.create({
      hostexId: Number(hostexId),
      title: launch.name,
      address: launch.address,
    } as any);

    return { launch: await this.findOne(launchId), propertyId: newProp.id, created: true };
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
