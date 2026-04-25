import { HealthGrade, DiagnosticTag } from '../enums/health.enum';

export interface PeriodRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  days: number;
}

export interface DiagnosticItem {
  key: DiagnosticTag;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  detail: string;
}

export interface PropertyHealthResult {
  propertyId: number;
  hostexId: number;
  title: string;
  nickname: string | null;
  areaCode: string | null;

  period: PeriodRange;

  // Financial metrics
  grossRevenue: number;
  commission: number;
  netRevenue: number;
  fixedCost: number;
  fixedBreakdown: Record<string, number>;
  costSource: 'monthly_report' | 'cost_entity' | 'none';
  hostexExpense: number;
  totalCosts: number;
  realProfit: number;
  profitMargin: number;
  commissionRate: number;
  fixedCostRatio: number;

  // Operational metrics
  occupiedNights: number;
  occupancyRate: number;
  revPAR: number;
  ADR: number;
  reservationCount: number;
  cancelledCount: number;
  cancellationRate: number;
  unpaidCount: number;

  // Channel breakdown
  channelRevenue: Record<string, number>;
  maxChannelShare: number;
  channelCount: number;

  // Scores
  subScores: {
    margin: number;
    revPar: number;
    occ: number;
    channel: number;
    cancel: number;
    count: number;
  };
  profitabilityScore: number;
  stabilityScore: number;
  healthScore: number;
  grade: HealthGrade;
  gradeLabel: string;
  gradeColor: string;

  // Diagnostics
  diagnostics: DiagnosticItem[];
}

export interface PortfolioSummary {
  period: PeriodRange;
  totalProperties: number;
  averageScore: number;
  gradeDistribution: Record<HealthGrade, number>;
  totalRevenue: number;
  totalNetProfit: number;
  averageOccupancy: number;
  averageProfitMargin: number;
  tagDistribution: Record<DiagnosticTag, number>;
}
