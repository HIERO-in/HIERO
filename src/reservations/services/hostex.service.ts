import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  HostexReservation,
  HostexReservationListResponse,
} from '../types/hostex.types';

@Injectable()
export class HostexService {
  private readonly logger = new Logger(HostexService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('HOSTEX_API_URL') ||
      'https://api.hostex.io/v3';
    this.apiToken = this.configService.get<string>('HOSTEX_API_TOKEN') || '';

    if (!this.apiToken) {
      this.logger.error('HOSTEX_API_TOKEN is not set in .env');
    }
  }

  // 한 배치 조회 (offset + limit)
  async fetchReservations(
    offset = 0,
    limit = 100,
  ): Promise<HostexReservationListResponse> {
    const url = `${this.apiUrl}/reservations?offset=${offset}&limit=${limit}`;

    this.logger.log(`Fetching offset=${offset} (limit=${limit})`);

    const response = await firstValueFrom(
      this.httpService.get<HostexReservationListResponse>(url, {
        headers: {
          'Hostex-Access-Token': this.apiToken,
        },
      }),
    );

    return response.data;
  }

  /**
   * 전체 예약 조회.
   *
   * Hostex API 특성 (Properties와 동일):
   *   - page / per_page / page_size / size 파라미터 전부 무시됨
   *   - offset + limit 조합만 작동
   *   - 응답 data.total 에 전체 개수 포함
   */
  async fetchAllReservations(): Promise<HostexReservation[]> {
    const all: HostexReservation[] = [];
    const seenCodes = new Set<string>();
    const BATCH_SIZE = 100;
    const MAX_ITERATIONS = 100; // 최대 10,000건
    let offset = 0;
    let total: number | null = null;
    let iter = 0;

    while (iter < MAX_ITERATIONS) {
      iter++;
      const response = await this.fetchReservations(offset, BATCH_SIZE);
      const payload = response.data || ({} as any);
      const reservations: HostexReservation[] = payload.reservations || [];

      // 전체 개수 (첫 요청에서 한 번만)
      if (total === null && typeof payload.total === 'number') {
        total = payload.total;
        this.logger.log(`전체 예약 수: ${total}건`);
      }

      if (reservations.length === 0) {
        this.logger.log(`offset=${offset}: 빈 응답, 종료`);
        break;
      }

      const newReservations = reservations.filter(
        (r) => !seenCodes.has(r.reservation_code),
      );

      if (newReservations.length === 0) {
        this.logger.log(
          `offset=${offset}: 새 데이터 없음 (중복), 종료`,
        );
        break;
      }

      newReservations.forEach((r) => seenCodes.add(r.reservation_code));
      all.push(...newReservations);

      this.logger.log(
        `offset=${offset}: ${newReservations.length}개 추가 (누적 ${all.length}${
          total ? `/${total}` : ''
        }건)`,
      );

      // total 도달하면 종료
      if (total !== null && all.length >= total) {
        this.logger.log(`전체 ${total}건 수집 완료`);
        break;
      }

      // 받은 데이터가 limit보다 적으면 마지막 배치
      if (reservations.length < BATCH_SIZE) {
        this.logger.log(`offset=${offset}: 마지막 배치`);
        break;
      }

      offset += reservations.length;
    }

    this.logger.log(`총 ${all.length}개 예약 조회 완료`);
    return all;
  }
}