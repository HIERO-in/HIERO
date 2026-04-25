import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CostsService } from '../costs/costs.service';
import { MonthlyReportsService } from '../monthly-reports/services/monthly-reports.service';
import { Property } from '../properties/entities/property.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Cost } from '../costs/entities/cost.entity';
import { MonthlyReportProperty } from '../monthly-reports/entities/monthly-report-property.entity';
import { UtilityMode } from '../costs/enums/owner-type.enum';
import {
  HealthGrade,
  DiagnosticTag,
  GRADE_LABELS,
  GRADE_COLORS,
} from './enums/health.enum';
import {
  PeriodRange,
  PropertyHealthResult,
  PortfolioSummary,
  DiagnosticItem,
} from './types/health.types';

// ── Constants ─────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_MONTH = 30;
const REVPAR_CEILING = 60_000;
const CANCELLED_STATUSES = ['cancelled', 'denied', 'refunded'];

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly reservationsService: ReservationsService,
    private readonly costsService: CostsService,
    private readonly monthlyReportsService: MonthlyReportsService,
  ) {}

  // ═══════════ Public API ═══════════

  async evaluatePortfolio(periodStr = '90d'): Promise<PropertyHealthResult[]> {
    const period = this.parsePeriod(periodStr);

    // 4 batch queries (no N+1)
    const [properties, allReservations, allCosts, mrpRows] = await Promise.all([
      this.propertiesService.findAll(),
      this.reservationsService.findAll({ from: period.start, to: period.end }),
      this.costsService.findAll(),
      this.fetchMrpForPeriod(period),
    ]);

    // Group reservations by propertyId (= hostexId in reservations table)
    // Key as string because property.hostexId is bigint (returned as string by TypeORM)
    const resByHostexId = new Map<string, Reservation[]>();
    for (const r of allReservations) {
      const key = String(r.propertyId);
      const list = resByHostexId.get(key) ?? [];
      list.push(r);
      resByHostexId.set(key, list);
    }

    // Cost lookup by hostexId string
    const costByHostexId = new Map<string, Cost>();
    for (const c of allCosts) costByHostexId.set(c.hostexId, c);

    // MRP lookup by propertyName (3-tier matching)
    const mrpByName = this.groupMrpByName(mrpRows);
    const propertyToMrps = this.matchPropertiesToMrp(properties, mrpByName);

    const results: PropertyHealthResult[] = [];
    for (const property of properties) {
      const reservations = resByHostexId.get(String(property.hostexId)) ?? [];
      const { fixedCost, fixedBreakdown, costSource } =
        this.getFixedCost(property, period, propertyToMrps, costByHostexId);
      results.push(
        this.evaluateProperty(property, reservations, fixedCost, fixedBreakdown, costSource, period),
      );
    }

    // Worst first
    results.sort((a, b) => a.healthScore - b.healthScore);
    return results;
  }

  async evaluateSingle(
    propertyId: number,
    periodStr = '90d',
  ): Promise<PropertyHealthResult> {
    const period = this.parsePeriod(periodStr);
    const property = await this.propertiesService.findOne(propertyId);
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const [reservations, allCosts, mrpRows] = await Promise.all([
      // reservation.propertyId = property.hostexId (Hostex listing ID)
      this.reservationsService.findByProperty(Number(property.hostexId), period.start, period.end),
      this.costsService.findAll(),
      this.fetchMrpForPeriod(period),
    ]);

    const costByHostexId = new Map<string, Cost>();
    for (const c of allCosts) costByHostexId.set(c.hostexId, c);

    const mrpByName = this.groupMrpByName(mrpRows);
    const propertyToMrps = this.matchPropertiesToMrp([property], mrpByName);

    const { fixedCost, fixedBreakdown, costSource } =
      this.getFixedCost(property, period, propertyToMrps, costByHostexId);

    return this.evaluateProperty(
      property, reservations, fixedCost, fixedBreakdown, costSource, period,
    );
  }

  async getPortfolioSummary(periodStr = '90d'): Promise<PortfolioSummary> {
    const results = await this.evaluatePortfolio(periodStr);
    const period = this.parsePeriod(periodStr);

    const gradeDistribution = {
      [HealthGrade.GOOD]: 0,
      [HealthGrade.CAUTION]: 0,
      [HealthGrade.RISK]: 0,
      [HealthGrade.CRITICAL]: 0,
    };
    const tagDistribution: Record<string, number> = {};
    let totalScore = 0;
    let totalRevenue = 0;
    let totalNetProfit = 0;
    let totalOcc = 0;
    let totalMargin = 0;

    for (const r of results) {
      gradeDistribution[r.grade]++;
      totalScore += r.healthScore;
      totalRevenue += r.grossRevenue;
      totalNetProfit += r.realProfit;
      totalOcc += r.occupancyRate;
      totalMargin += r.profitMargin;
      for (const d of r.diagnostics) {
        tagDistribution[d.key] = (tagDistribution[d.key] ?? 0) + 1;
      }
    }

    const n = results.length || 1;
    return {
      period,
      totalProperties: results.length,
      averageScore: Math.round(totalScore / n),
      gradeDistribution,
      totalRevenue: Math.round(totalRevenue),
      totalNetProfit: Math.round(totalNetProfit),
      averageOccupancy: Math.round((totalOcc / n) * 100) / 100,
      averageProfitMargin: Math.round((totalMargin / n) * 100) / 100,
      tagDistribution: tagDistribution as Record<DiagnosticTag, number>,
    };
  }

  // ═══════════ Core Scoring (exportable for unit tests) ═══════════

  evaluateProperty(
    property: Property,
    reservations: Reservation[],
    fixedCost: number,
    fixedBreakdown: Record<string, number>,
    costSource: 'monthly_report' | 'cost_entity' | 'none',
    period: PeriodRange,
  ): PropertyHealthResult {
    // Separate cancelled vs active
    const active = reservations.filter(
      (r) => !CANCELLED_STATUSES.includes(r.status),
    );
    const cancelled = reservations.filter((r) =>
      CANCELLED_STATUSES.includes(r.status),
    );

    // Filter by checkInDate within period for revenue/count
    const periodActive = active.filter(
      (r) => r.checkInDate >= period.start && r.checkInDate <= period.end,
    );
    const periodCancelled = cancelled.filter(
      (r) => r.checkInDate >= period.start && r.checkInDate <= period.end,
    );

    // Financial aggregation
    let grossRevenue = 0;
    let commission = 0;
    let unpaidCount = 0;
    let hostexExpense = 0;
    const channelRevenue: Record<string, number> = {};

    for (const r of periodActive) {
      const rate = Number(r.totalRate) || 0;
      const comm = Number(r.totalCommission) || 0;
      grossRevenue += rate;
      commission += comm;

      // Channel distribution
      const channel = r.customChannelName || r.channelType || '기타';
      channelRevenue[channel] = (channelRevenue[channel] ?? 0) + rate;

      // Hostex custom expenses from rawData
      hostexExpense += this.extractHostexExpense(r);
    }

    const netRevenue = grossRevenue - commission;
    const totalCosts = fixedCost + hostexExpense;
    const realProfit = netRevenue - totalCosts;

    // Occupancy (clip to period bounds, use ALL active reservations that overlap)
    const occupiedNights = this.computeOccupiedNights(active, period);
    const occupancyRate = period.days > 0
      ? Math.min((occupiedNights / period.days) * 100, 100)
      : 0;

    // Rates
    const profitMargin = grossRevenue > 0 ? (realProfit / grossRevenue) * 100 : 0;
    const revPAR = period.days > 0 ? netRevenue / period.days : 0;
    const ADR = occupiedNights > 0 ? grossRevenue / occupiedNights : 0;
    const commissionRate = grossRevenue > 0 ? (commission / grossRevenue) * 100 : 0;
    const fixedCostRatio = grossRevenue > 0 ? (fixedCost / grossRevenue) * 100 : 0;

    // Channel metrics
    const channelValues = Object.values(channelRevenue);
    const channelTotal = channelValues.reduce((a, b) => a + b, 0);
    const maxChannelShare = channelTotal > 0
      ? Math.max(...channelValues) / channelTotal
      : 0;

    // Cancellation
    const totalAttempts = periodActive.length + periodCancelled.length;
    const cancellationRate = totalAttempts > 0
      ? (periodCancelled.length / totalAttempts) * 100
      : 0;

    // ── Scoring ──
    const marginScore = clamp(50 + profitMargin * (50 / 30), 0, 100);
    const revParScore = clamp((revPAR / REVPAR_CEILING) * 100, 0, 100);
    const profitabilityScore = Math.round(marginScore * 0.7 + revParScore * 0.3);

    const occScore = clamp(occupancyRate, 0, 100);
    const channelScore = clamp((1 - maxChannelShare) * 150, 0, 100);
    const cancelScore = clamp(100 - cancellationRate * 5, 0, 100);
    const countScore = periodActive.length >= 5
      ? 100
      : (periodActive.length / 5) * 100;
    const stabilityScore = Math.round(
      occScore * 0.5 + channelScore * 0.2 + cancelScore * 0.15 + countScore * 0.15,
    );

    let healthScore = Math.round(profitabilityScore * 0.5 + stabilityScore * 0.5);

    // Grade
    let grade = this.scoreToGrade(healthScore);

    // low_data 강등: 예약 3건 미만이면 caution 이하로 강제
    if (periodActive.length < 3 && grade === HealthGrade.GOOD) {
      grade = HealthGrade.CAUTION;
      healthScore = Math.min(healthScore, 79);
    }

    // Diagnostics
    const diagnostics = this.buildDiagnostics({
      reservationCount: periodActive.length,
      unpaidCount,
      profitMargin,
      occupancyRate,
      maxChannelShare,
      channelRevenue,
      fixedCost,
      fixedCostRatio,
      commissionRate,
      realProfit,
    });

    return {
      propertyId: property.id,
      hostexId: property.hostexId,
      title: property.title,
      nickname: property.nickname ?? null,
      areaCode: property.areaCode ?? null,
      period,
      grossRevenue: Math.round(grossRevenue),
      commission: Math.round(commission),
      netRevenue: Math.round(netRevenue),
      fixedCost: Math.round(fixedCost),
      fixedBreakdown,
      costSource,
      hostexExpense: Math.round(hostexExpense),
      totalCosts: Math.round(totalCosts),
      realProfit: Math.round(realProfit),
      profitMargin: Math.round(profitMargin * 100) / 100,
      commissionRate: Math.round(commissionRate * 100) / 100,
      fixedCostRatio: Math.round(fixedCostRatio * 100) / 100,
      occupiedNights,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      revPAR: Math.round(revPAR),
      ADR: Math.round(ADR),
      reservationCount: periodActive.length,
      cancelledCount: periodCancelled.length,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      unpaidCount,
      channelRevenue,
      maxChannelShare: Math.round(maxChannelShare * 1000) / 1000,
      channelCount: Object.keys(channelRevenue).length,
      subScores: {
        margin: Math.round(marginScore * 100) / 100,
        revPar: Math.round(revParScore * 100) / 100,
        occ: Math.round(occScore * 100) / 100,
        channel: Math.round(channelScore * 100) / 100,
        cancel: Math.round(cancelScore * 100) / 100,
        count: Math.round(countScore * 100) / 100,
      },
      profitabilityScore,
      stabilityScore,
      healthScore,
      grade,
      gradeLabel: GRADE_LABELS[grade],
      gradeColor: GRADE_COLORS[grade],
      diagnostics,
    };
  }

  // ═══════════ Period Parsing ═══════════

  parsePeriod(periodStr: string): PeriodRange {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (periodStr === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: fmt(start),
        end: fmt(today),
        days: Math.ceil((today.getTime() - start.getTime()) / DAY_MS) + 1,
      };
    }
    if (periodStr === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: fmt(start),
        end: fmt(end),
        days: end.getDate(),
      };
    }

    const match = periodStr.match(/^(\d+)d$/);
    const days = match ? parseInt(match[1], 10) : 90;
    const start = new Date(today.getTime() - (days - 1) * DAY_MS);
    return { start: fmt(start), end: fmt(today), days };
  }

  // ═══════════ Occupancy ═══════════

  private computeOccupiedNights(
    activeReservations: Reservation[],
    period: PeriodRange,
  ): number {
    let total = 0;
    const pStart = new Date(period.start).getTime();
    const pEnd = new Date(period.end).getTime();

    for (const r of activeReservations) {
      const ci = new Date(r.checkInDate).getTime();
      const co = new Date(r.checkOutDate).getTime();
      const from = Math.max(ci, pStart);
      const to = Math.min(co, pEnd);
      if (to > from) {
        total += Math.round((to - from) / DAY_MS);
      }
    }
    return total;
  }

  // ═══════════ Hostex Custom Expenses ═══════════

  private readonly REVENUE_TYPES = new Set([
    'ACCOMMODATION', 'CLEANING_FEE', 'OUT_NUMBER_FEE',
    'PET_FEE', 'HOUSE_EXTENSION_FEE', 'PLATFORM_SUBSIDIES',
  ]);
  private readonly COMMISSION_TYPES = new Set([
    'HOST_SERVICE_FEE', 'CANCELLATION_REFUND_FROM_HOST',
  ]);

  private extractHostexExpense(reservation: Reservation): number {
    const details = reservation.rawData?.rates?.details;
    if (!Array.isArray(details)) return 0;

    let expense = 0;
    for (const d of details) {
      if (
        d.type &&
        !this.REVENUE_TYPES.has(d.type) &&
        !this.COMMISSION_TYPES.has(d.type)
      ) {
        expense += Math.abs(Number(d.amount) || 0);
      }
    }
    return expense;
  }

  // ═══════════ Cost Resolution (3-tier priority) ═══════════

  private getFixedCost(
    property: Property,
    period: PeriodRange,
    propertyToMrps: Map<number, MonthlyReportProperty[]>,
    costByHostexId: Map<string, Cost>,
  ): { fixedCost: number; fixedBreakdown: Record<string, number>; costSource: 'monthly_report' | 'cost_entity' | 'none' } {
    const ratio = period.days / DAYS_IN_MONTH;

    // Priority 1: Monthly Report data
    const mrps = propertyToMrps.get(property.id);
    if (mrps && mrps.length > 0) {
      const avg: Record<string, number> = {
        rentOut: 0, cleaningCost: 0, mgmt: 0, operation: 0,
        labor: 0, interior: 0, supplies: 0, refund: 0,
      };
      for (const m of mrps) {
        avg.rentOut += Math.abs(Number(m.rentOut));
        avg.cleaningCost += Math.abs(Number(m.cleaningCost));
        avg.mgmt += Math.abs(Number(m.mgmt));
        avg.operation += Math.abs(Number(m.operation));
        avg.labor += Math.abs(Number(m.labor));
        avg.interior += Math.abs(Number(m.interior));
        avg.supplies += Math.abs(Number(m.supplies));
        avg.refund += Math.abs(Number(m.refund));
      }
      const n = mrps.length;
      const breakdown: Record<string, number> = {};
      let total = 0;
      for (const [key, val] of Object.entries(avg)) {
        const prorated = Math.round((val / n) * ratio);
        breakdown[key] = prorated;
        total += prorated;
      }
      return { fixedCost: total, fixedBreakdown: breakdown, costSource: 'monthly_report' };
    }

    // Priority 2: Cost entity (manual input)
    const hostexIdStr = String(property.hostexId);
    const cost = costByHostexId.get(hostexIdStr);
    if (cost) {
      const breakdown: Record<string, number> = {
        rent: Math.round(cost.rent * ratio),
        loanInterest: Math.round(cost.loanInterest * ratio),
        depreciation: Math.round(cost.depreciation * ratio),
        annualTax: Math.round(cost.annualTax * (period.days / 365)),
        consignedFixed: Math.round(cost.consignedFixedPay * ratio),
        utilitiesFixed: 0,
      };
      if (cost.utilities) {
        for (const [, item] of Object.entries(cost.utilities)) {
          if (item && item.mode === UtilityMode.FIXED) {
            breakdown.utilitiesFixed += Math.round(item.amount * ratio);
          }
        }
      }
      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      return { fixedCost: total, fixedBreakdown: breakdown, costSource: 'cost_entity' };
    }

    // Priority 3: none
    return { fixedCost: 0, fixedBreakdown: {}, costSource: 'none' };
  }

  // ═══════════ Property ↔ MRP Matching (3-tier) ═══════════

  private groupMrpByName(
    rows: MonthlyReportProperty[],
  ): Map<string, MonthlyReportProperty[]> {
    const map = new Map<string, MonthlyReportProperty[]>();
    for (const r of rows) {
      const list = map.get(r.propertyName) ?? [];
      list.push(r);
      map.set(r.propertyName, list);
    }
    return map;
  }

  private matchPropertiesToMrp(
    properties: Property[],
    mrpByName: Map<string, MonthlyReportProperty[]>,
  ): Map<number, MonthlyReportProperty[]> {
    const result = new Map<number, MonthlyReportProperty[]>();

    // Build normalized & hostexId lookup
    const normalizedMap = new Map<string, MonthlyReportProperty[]>();
    for (const [name, rows] of mrpByName) {
      normalizedMap.set(this.normalize(name), rows);
    }

    for (const property of properties) {
      // Tier 1: exact match on title
      let matched = mrpByName.get(property.title);

      // Tier 2: normalized (trim + lowercase)
      if (!matched) {
        matched = normalizedMap.get(this.normalize(property.title));
      }
      if (!matched && property.nickname) {
        matched = normalizedMap.get(this.normalize(property.nickname));
      }

      // Tier 3: hostexId in name (e.g. name contains hostexId number)
      if (!matched) {
        const hid = String(property.hostexId);
        for (const [name, rows] of mrpByName) {
          if (name.includes(hid)) {
            matched = rows;
            break;
          }
        }
      }

      if (matched) {
        result.set(property.id, matched);
      } else {
        this.logger.warn(
          `MRP 매칭 실패: property.id=${property.id} title="${property.title}" hostexId=${property.hostexId}`,
        );
      }
    }

    return result;
  }

  private normalize(s: string): string {
    return s.replace(/[\s_\-:：]/g, '').toLowerCase();
  }

  // ═══════════ Grade ═══════════

  scoreToGrade(score: number): HealthGrade {
    if (score >= 80) return HealthGrade.GOOD;
    if (score >= 60) return HealthGrade.CAUTION;
    if (score >= 40) return HealthGrade.RISK;
    return HealthGrade.CRITICAL;
  }

  // ═══════════ Diagnostics ═══════════

  private buildDiagnostics(m: {
    reservationCount: number;
    unpaidCount: number;
    profitMargin: number;
    occupancyRate: number;
    maxChannelShare: number;
    channelRevenue: Record<string, number>;
    fixedCost: number;
    fixedCostRatio: number;
    commissionRate: number;
    realProfit: number;
  }): DiagnosticItem[] {
    const tags: DiagnosticItem[] = [];

    if (m.reservationCount < 3) {
      tags.push({
        key: DiagnosticTag.LOW_DATA,
        label: '데이터 부족',
        tone: 'neutral',
        detail: `예약 ${m.reservationCount}건만 있어 평가 신뢰도 낮음`,
      });
    }

    if (m.unpaidCount > 0) {
      tags.push({
        key: DiagnosticTag.UNPAID,
        label: '미수금',
        tone: 'danger',
        detail: `미수금 ${m.unpaidCount}건 — 수금 필요`,
      });
    }

    if (m.profitMargin >= 20 && m.occupancyRate < 50 && m.reservationCount >= 3) {
      tags.push({
        key: DiagnosticTag.OVERPRICED,
        label: '고가 의심',
        tone: 'warning',
        detail: `마진 ${Math.round(m.profitMargin)}% vs 점유율 ${Math.round(m.occupancyRate)}% → 가격 인하 테스트 권장`,
      });
    }

    if (m.profitMargin < 10 && m.occupancyRate > 80) {
      tags.push({
        key: DiagnosticTag.UNDERPRICED,
        label: '저가 의심',
        tone: 'warning',
        detail: `점유율 ${Math.round(m.occupancyRate)}% 높지만 마진 ${Math.round(m.profitMargin)}% 낮음 → 가격 인상 여력`,
      });
    }

    const channelValues = Object.values(m.channelRevenue);
    const channelTotal = channelValues.reduce((a, b) => a + b, 0);
    if (m.maxChannelShare > 0.7 && channelTotal > 0) {
      const topChannel = Object.entries(m.channelRevenue)
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';
      tags.push({
        key: DiagnosticTag.CHANNEL_DEP,
        label: '채널 편중',
        tone: 'warning',
        detail: `${topChannel}이 ${Math.round(m.maxChannelShare * 100)}% 차지 → 채널 다변화 필요`,
      });
    }

    if (m.fixedCost > 0 && m.fixedCostRatio > 80) {
      tags.push({
        key: DiagnosticTag.HIGH_FIXED,
        label: '고정비 과다',
        tone: 'danger',
        detail: `매출 대비 고정비 ${Math.round(m.fixedCostRatio)}% → 재계약 또는 정리 검토`,
      });
    }

    if (m.commissionRate > 20) {
      tags.push({
        key: DiagnosticTag.HIGH_COMMISSION,
        label: '수수료 과다',
        tone: 'warning',
        detail: `수수료율 ${Math.round(m.commissionRate)}% → 수수료 낮은 채널 비중 확대 권장`,
      });
    }

    if (m.realProfit < 0 && m.reservationCount >= 3) {
      tags.push({
        key: DiagnosticTag.LOSS,
        label: '적자',
        tone: 'danger',
        detail: `기간 순손실 ${Math.round(m.realProfit).toLocaleString()}원`,
      });
    }

    // Positive: healthy
    if (
      m.profitMargin >= 25 &&
      m.occupancyRate >= 60 &&
      m.maxChannelShare < 0.7 &&
      m.unpaidCount === 0
    ) {
      tags.push({
        key: DiagnosticTag.HEALTHY,
        label: '건강',
        tone: 'success',
        detail: '수익·점유·안정성 모두 양호 → 유사 물건 확보 추천',
      });
    }

    return tags;
  }

  // ═══════════ Helpers ═══════════

  private async fetchMrpForPeriod(
    period: PeriodRange,
  ): Promise<MonthlyReportProperty[]> {
    const months = this.getMonthsBetween(period.start, period.end);
    if (months.length === 0) return [];
    return this.monthlyReportsService.findPropertiesByMonths(months);
  }

  private getMonthsBetween(start: string, end: string): string[] {
    const months: string[] = [];
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    let y = sy;
    let m = sm;
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  }
}

// ── Utility ──
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
