export enum HealthPeriod {
  DAYS_7 = '7d',
  DAYS_14 = '14d',
  DAYS_30 = '30d',
  DAYS_90 = '90d',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
}

export enum HealthGrade {
  GOOD = 'good',
  CAUTION = 'caution',
  RISK = 'risk',
  CRITICAL = 'critical',
}

export const GRADE_LABELS: Record<HealthGrade, string> = {
  [HealthGrade.GOOD]: '양호',
  [HealthGrade.CAUTION]: '주의',
  [HealthGrade.RISK]: '위험',
  [HealthGrade.CRITICAL]: '긴급',
};

export const GRADE_COLORS: Record<HealthGrade, string> = {
  [HealthGrade.GOOD]: '#4A7A4A',
  [HealthGrade.CAUTION]: '#B8842F',
  [HealthGrade.RISK]: '#C65D3A',
  [HealthGrade.CRITICAL]: '#A63D2A',
};

export enum DiagnosticTag {
  LOW_DATA = 'low_data',
  UNPAID = 'unpaid',
  OVERPRICED = 'overpriced',
  UNDERPRICED = 'underpriced',
  CHANNEL_DEP = 'channel_dep',
  HIGH_FIXED = 'high_fixed',
  HIGH_COMMISSION = 'high_commission',
  LOSS = 'loss',
  HEALTHY = 'healthy',
}
