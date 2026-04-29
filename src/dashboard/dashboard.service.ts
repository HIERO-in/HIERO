import { Injectable } from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';
import { PropertiesService } from '../properties/properties.service';
import { Reservation } from '../reservations/entities/reservation.entity';

const DAY_MS = 86400000;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

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
  ) {}

  async getSalesAnalytics(periodKey = 'this_month') {
    const period = parsePeriod(periodKey);
    const todayStr = fmt(new Date());
    const in7d = fmt(new Date(Date.now() + 7 * DAY_MS));

    const [allRes, properties] = await Promise.all([
      this.reservationsService.findAll({ from: period.start, to: period.end }),
      this.propertiesService.findAll(),
    ]);

    const propMap = new Map(properties.map((p) => [String(p.hostexId), p]));

    // 기간 내 활성 예약
    const active = allRes.filter((r) => !['cancelled', 'denied', 'refunded'].includes(r.status));
    const periodActive = active.filter(
      (r) => r.checkInDate >= period.start && r.checkInDate <= period.end,
    );

    // ── todayLive ──
    const todayRes = active.filter((r) => r.checkInDate === todayStr);
    const todayRevenue = todayRes.reduce((s, r) => s + (Number(r.totalRate) || 0), 0);
    const todayNights = todayRes.reduce((s, r) => s + (r.nights || 1), 0);
    const todayChannelMix: Record<string, number> = {};
    for (const r of todayRes) {
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
    // unpaid: tags에 미납 또는 customChannelName이 '미납'
    for (const r of allRes) {
      if (r.customChannelName === '미납' || (r.tags && r.tags.includes('미납'))) unpaid++;
    }

    const todayLive = {
      reservations: todayRes.length,
      revenue: todayRevenue,
      adr: todayNights > 0 ? Math.round(todayRevenue / todayNights) : 0,
      channelMix: todayChannelMix,
      checkIn: checkInToday,
      checkOut: checkOutToday,
      inHouse,
      upcoming7d,
      unpaid,
    };

    // ── channelDonut ──
    const chMap: Record<string, { revenue: number; count: number; nights: number }> = {};
    for (const r of periodActive) {
      const ch = r.customChannelName || r.channelType || '기타';
      if (!chMap[ch]) chMap[ch] = { revenue: 0, count: 0, nights: 0 };
      chMap[ch].revenue += Number(r.totalRate) || 0;
      chMap[ch].count += 1;
      chMap[ch].nights += r.nights || 1;
    }
    const totalRevenue = Object.values(chMap).reduce((s, v) => s + v.revenue, 0);
    const channelDonut = Object.entries(chMap)
      .map(([channel, v]) => ({
        channel,
        revenue: v.revenue,
        count: v.count,
        share: totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 1000) / 10 : 0,
        avgADR: v.nights > 0 ? Math.round(v.revenue / v.nights) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 의존도 경고
    const dependencyWarning = channelDonut.length > 0 && channelDonut[0].share >= 50
      ? `${channelDonut[0].channel} 의존도 ${channelDonut[0].share}%, 분산 검토 필요`
      : null;

    // ── channelADR ──
    const totalNights = periodActive.reduce((s, r) => s + (r.nights || 1), 0);
    const overallADR = totalNights > 0
      ? Math.round(totalRevenue / totalNights)
      : 0;
    const channelADR = channelDonut.map((c) => ({
      channel: c.channel,
      adr: c.avgADR,
      count: c.count,
    }));

    // ── dailyTrend ──
    const dailyMap = new Map<string, { revenue: number; count: number; channels: Record<string, number> }>();
    for (const r of periodActive) {
      const key = r.checkInDate;
      const entry = dailyMap.get(key) || { revenue: 0, count: 0, channels: {} };
      entry.revenue += Number(r.totalRate) || 0;
      entry.count += 1;
      const ch = r.customChannelName || r.channelType || '기타';
      entry.channels[ch] = (entry.channels[ch] ?? 0) + (Number(r.totalRate) || 0);
      dailyMap.set(key, entry);
    }
    const dailyTrend = [...dailyMap.entries()]
      .map(([date, v]) => ({ date, ...v, channelBreakdown: v.channels }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── propertyMatrix ──
    const propRevMap: Record<string, { revenue: number; commission: number; count: number; nights: number }> = {};
    for (const r of periodActive) {
      const pid = String(r.propertyId);
      if (!propRevMap[pid]) propRevMap[pid] = { revenue: 0, commission: 0, count: 0, nights: 0 };
      propRevMap[pid].revenue += Number(r.totalRate) || 0;
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
          revenue: v.revenue,
          net: v.revenue - v.commission,
          adr: v.nights > 0 ? Math.round(v.revenue / v.nights) : 0,
          count: v.count,
          nights: v.nights,
        };
      })
      .sort((a, b) => b.net - a.net);

    return {
      period,
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
