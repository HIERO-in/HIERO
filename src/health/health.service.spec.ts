import { HealthService } from './health.service';
import { HealthGrade } from './enums/health.enum';
import { Property } from '../properties/entities/property.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { MonthlyReportProperty } from '../monthly-reports/entities/monthly-report-property.entity';

/**
 * 순수 계산 함수 단위테스트.
 * DB 의존 없이 evaluateProperty()와 parsePeriod()만 검증.
 */
describe('HealthService — scoring logic', () => {
  let service: HealthService;

  beforeEach(() => {
    // null deps: 순수 계산 함수만 테스트하므로 DI 불필요
    service = new HealthService(null as any, null as any, null as any, null as any, null as any);
  });

  // ── helpers ──
  function makeProperty(overrides: Partial<Property> = {}): Property {
    return {
      id: 1,
      hostexId: 100,
      title: 'Test Property',
      nickname: 'T1',
      areaCode: 'A',
      ...overrides,
    } as Property;
  }

  function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
    return {
      id: 1,
      reservationCode: 'R001',
      propertyId: 1,
      channelType: 'airbnb',
      customChannelName: 'Airbnb',
      checkInDate: '2026-03-01',
      checkOutDate: '2026-03-04',
      nights: 3,
      totalRate: 300000,
      totalCommission: 30000,
      status: 'confirmed',
      rawData: null,
      ...overrides,
    } as Reservation;
  }

  const period = { start: '2026-03-01', end: '2026-05-29', days: 90 };

  // ────────────────────────────────────────

  it('should assign GOOD grade for a high-performing property', () => {
    // 10 reservations over 90 days, ~70 nights occupancy, good revenue
    const reservations = Array.from({ length: 10 }, (_, i) => {
      const day = (i * 9) + 1;
      const month = day <= 31 ? '03' : day <= 61 ? '04' : '05';
      const d = day <= 31 ? day : day <= 61 ? day - 31 : day - 61;
      const dEnd = d + 7;
      return makeReservation({
        id: i + 1,
        reservationCode: `R${i}`,
        checkInDate: `2026-${month}-${String(d).padStart(2, '0')}`,
        checkOutDate: `2026-${month}-${String(Math.min(dEnd, 28)).padStart(2, '0')}`,
        nights: 7,
        totalRate: 700000,
        totalCommission: 70000,
        customChannelName: i % 3 === 0 ? 'Airbnb' : i % 3 === 1 ? '리브' : '자리톡',
      });
    });

    const result = service.evaluateProperty(
      makeProperty(),
      reservations,
      300000,       // fixedCost
      { rent: 300000 },
      'cost_entity',
      period,
    );

    expect(result.healthScore).toBeGreaterThanOrEqual(80);
    expect(result.grade).toBe(HealthGrade.GOOD);
    expect(result.grossRevenue).toBe(7000000);
    expect(result.reservationCount).toBe(10);
    expect(result.channelCount).toBe(3);
  });

  it('should assign CRITICAL grade for a loss-making property with low data', () => {
    const reservations = [
      makeReservation({
        checkInDate: '2026-03-10',
        checkOutDate: '2026-03-12',
        nights: 2,
        totalRate: 50000,
        totalCommission: 10000,
      }),
    ];

    const result = service.evaluateProperty(
      makeProperty(),
      reservations,
      500000,       // heavy fixedCost
      { rent: 500000 },
      'cost_entity',
      period,
    );

    expect(result.healthScore).toBeLessThan(40);
    expect([HealthGrade.CRITICAL, HealthGrade.RISK]).toContain(result.grade);
    expect(result.realProfit).toBeLessThan(0);
    expect(result.diagnostics.some((d) => d.key === 'low_data')).toBe(true);
  });

  it('should downgrade GOOD to CAUTION when reservations < 3', () => {
    // 2 reservations with great numbers
    const reservations = [1, 2].map((i) =>
      makeReservation({
        id: i,
        reservationCode: `R${i}`,
        checkInDate: `2026-03-0${i}`,
        checkOutDate: `2026-04-0${i}`,
        nights: 30,
        totalRate: 2000000,
        totalCommission: 100000,
        customChannelName: i === 1 ? 'Airbnb' : '리브',
      }),
    );

    const result = service.evaluateProperty(
      makeProperty(),
      reservations,
      100000,
      { rent: 100000 },
      'cost_entity',
      period,
    );

    // Even with great metrics, low data caps grade at CAUTION
    expect(result.grade).not.toBe(HealthGrade.GOOD);
    expect(result.diagnostics.some((d) => d.key === 'low_data')).toBe(true);
  });

  it('parsePeriod should correctly parse Nd format', () => {
    const p = service.parsePeriod('30d');
    expect(p.days).toBe(30);
    expect(p.end).toBeDefined();
    expect(p.start).toBeDefined();
  });

  it('scoreToGrade should return correct grades', () => {
    expect(service.scoreToGrade(85)).toBe(HealthGrade.GOOD);
    expect(service.scoreToGrade(70)).toBe(HealthGrade.CAUTION);
    expect(service.scoreToGrade(45)).toBe(HealthGrade.RISK);
    expect(service.scoreToGrade(20)).toBe(HealthGrade.CRITICAL);
  });
});

// ── MRP Matching Tests ──────────────────────

describe('HealthService — MRP matching', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService(null as any, null as any, null as any, null as any, null as any);
  });

  function makeMrp(propertyName: string, month = '2026-03'): MonthlyReportProperty {
    return {
      propertyName,
      month,
      rentOut: '100000',
      cleaningCost: '50000',
      mgmt: '30000',
      operation: '20000',
      labor: '0',
      interior: '0',
      supplies: '0',
      refund: '0',
    } as any;
  }

  function makeProperty(overrides: Partial<Property> = {}): Property {
    return {
      id: 1,
      hostexId: 12345678,
      title: 'A22_예건 202_수동_Q1_TV(케이블)',
      nickname: '예건 202',
      ...overrides,
    } as Property;
  }

  // Access private methods via bracket notation for testing
  function groupMrpByName(rows: MonthlyReportProperty[]) {
    return (service as any).groupMrpByName(rows);
  }

  function matchPropertiesToMrp(
    properties: Property[],
    mrpByName: Map<string, MonthlyReportProperty[]>,
  ) {
    return (service as any).matchPropertiesToMrp(properties, mrpByName);
  }

  it('exact match: title === propertyName', () => {
    const mrps = [makeMrp('A22_예건 202_수동_Q1_TV(케이블)')];
    const mrpByName = groupMrpByName(mrps);
    const props = [makeProperty()];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.has(1)).toBe(true);
    expect(result.get(1)).toHaveLength(1);
  });

  it('normalized match: spaces/underscores differ', () => {
    const mrps = [makeMrp('a22_예건 202_수동_q1_tv(케이블)')];
    const mrpByName = groupMrpByName(mrps);
    // Property title uses different casing
    const props = [makeProperty({ title: 'A22_예건 202_수동_Q1_TV(케이블)' })];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.has(1)).toBe(true);
  });

  it('hostexId fallback: title differs but hostexId in MRP name', () => {
    const mrps = [makeMrp('12345678_완전다른이름')];
    const mrpByName = groupMrpByName(mrps);
    const props = [makeProperty({ title: '전혀 다른 타이틀' })];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.has(1)).toBe(true);
  });

  it('MRP 데이터 부재 시 매칭 없음 (costSource none으로 fallback)', () => {
    const mrpByName = new Map<string, MonthlyReportProperty[]>();
    const props = [makeProperty()];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.has(1)).toBe(false);
  });

  it('매칭 우선순위: exact > normalized > hostexId', () => {
    // exact match 가능한 데이터와 hostexId 매칭 가능한 데이터 동시 존재
    const exactMrp = makeMrp('A22_예건 202_수동_Q1_TV(케이블)', '2026-03');
    const hostexMrp = makeMrp('12345678_다른이름', '2026-04');
    const mrpByName = groupMrpByName([exactMrp, hostexMrp]);
    const props = [makeProperty()];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.has(1)).toBe(true);
    // exact match가 우선이므로 '예건 202' 포함한 MRP가 매칭됨
    const matched = result.get(1)!;
    expect(matched[0].propertyName).toBe('A22_예건 202_수동_Q1_TV(케이블)');
  });

  it('multiple months: 같은 호실 2개월분 매칭', () => {
    const mrps = [
      makeMrp('A22_예건 202_수동_Q1_TV(케이블)', '2026-03'),
      makeMrp('A22_예건 202_수동_Q1_TV(케이블)', '2026-04'),
    ];
    const mrpByName = groupMrpByName(mrps);
    const props = [makeProperty()];

    const result = matchPropertiesToMrp(props, mrpByName);

    expect(result.get(1)).toHaveLength(2);
  });
});
