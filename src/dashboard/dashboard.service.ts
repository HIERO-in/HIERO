import { Injectable } from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';
import { PropertiesService } from '../properties/properties.service';
import { TransactionsService } from '../transactions/services/transactions.service';

const DAY_MS = 86400000;
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function parsePeriod(key: string): { start: string; end: string; days: number } {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  switch (key) {
    case '1d':
    case 'today': return { start: fmt(d), end: fmt(d), days: 1 };
    case 'yesterday': { const y = new Date(d.getTime() - DAY_MS); return { start: fmt(y), end: fmt(y), days: 1 }; }
    case '7d': return { start: fmt(new Date(d.getTime() - 6 * DAY_MS)), end: fmt(d), days: 7 };
    case '14d': return { start: fmt(new Date(d.getTime() - 13 * DAY_MS)), end: fmt(d), days: 14 };
    case '30d': return { start: fmt(new Date(d.getTime() - 29 * DAY_MS)), end: fmt(d), days: 30 };
    case '90d': return { start: fmt(new Date(d.getTime() - 89 * DAY_MS)), end: fmt(d), days: 90 };
    case 'this_month': {
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start: fmt(s), end: fmt(e), days: Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1 };
    }
    case 'last_month': {
      const s = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const e = new Date(d.getFullYear(), d.getMonth(), 0);
      return { start: fmt(s), end: fmt(e), days: Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1 };
    }
    default: {
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start: fmt(s), end: fmt(e), days: Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1 };
    }
  }
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly propertiesService: PropertiesService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getSalesAnalytics(periodKey = 'this_month') {
    const period = parsePeriod(periodKey);
    const todayStr = fmt(new Date());
    const in7d = fmt(new Date(Date.now() + 7 * DAY_MS));

    const [allRes, properties, txSummary] = await Promise.all([
      this.reservationsService.findAll({ from: period.start, to: period.end }),
      this.propertiesService.findAll(),
      this.transactionsService.getExpenseSummary(period.start, period.end),
    ]);

    const propMap = new Map(properties.map((p) => [String(p.hostexId), p]));

    const active = allRes.filter((r) => !['cancelled', 'denied', 'refunded'].includes(r.status));

    // A: 매출 = 해당 기간에 판매된 건 (bookedAt 기준)
    const bookedInPeriod = active.filter((r) => {
      const booked = r.bookedAt ? fmt(new Date(r.bookedAt)) : r.checkInDate;
      return booked >= period.start && booked <= period.end;
    });

    // B: 예정금액 = revenueDate(채널별 입금예정일)가 해당 기간에 속하는 건
    const depositInPeriod = active.filter((r) => {
      const rd = r.revenueDate || r.checkInDate;
      return rd >= period.start && rd <= period.end;
    });

    // 체크인 기준 (채널믹스, 일별 트렌드 등)
    const periodActive = active.filter(
      (r) => r.checkInDate >= period.start && r.checkInDate <= period.end,
    );

    // 3단 금액
    const grossRevenue = bookedInPeriod.reduce((s, r) => s + (Number(r.totalRate) || 0), 0);
    const expectedRevenue = depositInPeriod.reduce((s, r) => s + ((Number(r.totalRate) || 0) - (Number(r.totalCommission) || 0)), 0);
    const expectedCommission = depositInPeriod.reduce((s, r) => s + (Number(r.totalCommission) || 0), 0);
    const actualDeposit = txSummary.totalIncome || 0;

    // 추가: 일매출 (오늘 재실중인 호실의 1/n)
    const inHouseRes = active.filter((r) => r.checkInDate <= todayStr && r.checkOutDate > todayStr);
    const dailyEarning = inHouseRes.reduce((s, r) => {
      const nights = r.nights || 1;
      return s + Math.round((Number(r.totalRate) || 0) / nights);
    }, 0);

    // todayLive
    const todayBooked = active.filter((r) => {
      const booked = r.bookedAt ? fmt(new Date(r.bookedAt)) : null;
      return booked === todayStr;
    });
    const todayGross = todayBooked.reduce((s, r) => s + (Number(r.totalRate) || 0), 0);
    const todayDepositRes = active.filter((r) => (r.revenueDate || r.checkInDate) === todayStr);
    const todayExpected = todayDepositRes.reduce((s, r) => s + ((Number(r.totalRate) || 0) - (Number(r.totalCommission) || 0)), 0);
    const todayCheckInRes = active.filter((r) => r.checkInDate === todayStr);
    const todayNights = todayCheckInRes.reduce((s, r) => s + (r.nights || 1), 0);
    const todayChannelMix: Record<string, number> = {};
    for (const r of todayBooked) {
      const ch = r.customChannelName || r.channelType || '기타';
      todayChannelMix[ch] = (todayChannelMix[ch] ?? 0) + 1;
    }

    let inHouse = 0, checkInToday = 0, checkOutToday = 0, upcoming7d = 0, unpaid = 0;
    for (const r of active) {
      if (r.checkInDate <= todayStr && r.checkOutDate > todayStr) inHouse++;
      if (r.checkInDate === todayStr) checkInToday++;
      if (r.checkOutDate === todayStr) checkOutToday++;
      if (r.checkInDate > todayStr && r.checkInDate <= in7d) upcoming7d++;
    }
    for (const r of allRes) {
      if (r.customChannelName === '미납' || (r.tags && r.tags.includes('미납'))) unpaid++;
    }

    const todayLive = {
      reservations: todayBooked.length,
      grossRevenue: todayGross,
      expectedRevenue: todayExpected,
      depositCount: todayDepositRes.length,
      dailyEarning,
      adr: todayNights > 0 ? Math.round(todayGross / todayNights) : 0,
      channelMix: todayChannelMix,
      checkIn: checkInToday,
      checkOut: checkOutToday,
      inHouse,
      upcoming7d,
      unpaid,
      revenue: todayGross,
    };

    // channelDonut
    const chMap: Record<string, { gross: number; commission: number; count: number; nights: number }> = {};
    for (const r of periodActive) {
      const ch = r.customChannelName || r.channelType || '기타';
      if (!chMap[ch]) chMap[ch] = { gross: 0, commission: 0, count: 0, nights: 0 };
      chMap[ch].gross += Number(r.totalRate) || 0;
      chMap[ch].commission += Number(r.totalCommission) || 0;
      chMap[ch].count += 1;
      chMap[ch].nights += r.nights || 1;
    }
    const totalChRevenue = Object.values(chMap).reduce((s, v) => s + v.gross, 0);
    const channelDonut = Object.entries(chMap)
      .map(([channel, v]) => ({
        channel,
        revenue: v.gross,
        expected: v.gross - v.commission,
        commission: v.commission,
        count: v.count,
        share: totalChRevenue > 0 ? Math.round((v.gross / totalChRevenue) * 1000) / 10 : 0,
        avgADR: v.nights > 0 ? Math.round(v.gross / v.nights) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const dependencyWarning = channelDonut.length > 0 && channelDonut[0].share >= 50
      ? `${channelDonut[0].channel} 의존도 ${channelDonut[0].share}%, 분산 검토 필요`
      : null;

    const totalNights = periodActive.reduce((s, r) => s + (r.nights || 1), 0);
    const overallADR = totalNights > 0 ? Math.round(totalChRevenue / totalNights) : 0;
    const channelADR = channelDonut.map((c) => ({ channel: c.channel, adr: c.avgADR, count: c.count }));

    // dailyTrend
    const dailyMap = new Map<string, { gross: number; expected: number; count: number; channels: Record<string, number> }>();
    for (const r of periodActive) {
      const key = r.checkInDate;
      const entry = dailyMap.get(key) || { gross: 0, expected: 0, count: 0, channels: {} };
      const rate = Number(r.totalRate) || 0;
      const comm = Number(r.totalCommission) || 0;
      entry.gross += rate;
      entry.expected += rate - comm;
      entry.count += 1;
      const ch = r.customChannelName || r.channelType || '기타';
      entry.channels[ch] = (entry.channels[ch] ?? 0) + rate;
      dailyMap.set(key, entry);
    }
    const dailyTrend = [...dailyMap.entries()]
      .map(([date, v]) => ({ date, revenue: v.gross, expected: v.expected, count: v.count, channelBreakdown: v.channels }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // propertyMatrix
    const propRevMap: Record<string, { gross: number; commission: number; count: number; nights: number }> = {};
    for (const r of periodActive) {
      const pid = String(r.propertyId);
      if (!propRevMap[pid]) propRevMap[pid] = { gross: 0, commission: 0, count: 0, nights: 0 };
      propRevMap[pid].gross += Number(r.totalRate) || 0;
      propRevMap[pid].commission += Number(r.totalCommission) || 0;
      propRevMap[pid].count += 1;
      propRevMap[pid].nights += r.nights || 1;
    }
    const propertyMatrix = Object.entries(propRevMap)
      .map(([pid, v]) => {
        const prop = propMap.get(pid);
        return {
          propertyId: prop?.id ?? pid,
          hostexId: pid,
          title: prop?.title ?? `#${pid}`,
          revenue: v.gross,
          expected: v.gross - v.commission,
          commission: v.commission,
          net: v.gross - v.commission,
          adr: v.nights > 0 ? Math.round(v.gross / v.nights) : 0,
          count: v.count,
          nights: v.nights,
        };
      })
      .sort((a, b) => b.net - a.net);

    return {
      period,
      revenueBreakdown: {
        grossRevenue,
        bookedCount: bookedInPeriod.length,
        expectedRevenue,
        expectedCommission,
        depositCount: depositInPeriod.length,
        actualDeposit,
        gap: expectedRevenue - actualDeposit,
        dailyEarning,
        inHouseCount: inHouseRes.length,
      },
      todayLive,
      channelDonut,
      dependencyWarning,
      channelADR,
      overallADR,
      dailyTrend,
      propertyMatrix,
    };
  }
}
