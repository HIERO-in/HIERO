import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface HostexProperty {
  id: number;
  title: string;
  channels: any[];
  cover?: {
    filename?: string;
    original_url?: string;
    small_url?: string;
    medium_url?: string;
    large_url?: string;
    extra_large_url?: string;
    extra_extra_large_url?: string;
  };
  default_checkin_time?: string;
  default_checkout_time?: string;
  timezone?: string;
  wifi_ssid?: string;
  wifi_password?: string;
  wifi_remarks?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
  google_place_payload?: string | object;
  [key: string]: any; // 알 수 없는 필드도 허용
}

@Injectable()
export class HostexPropertyService {
  private readonly logger = new Logger(HostexPropertyService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('HOSTEX_API_URL') ||
      'https://api.hostex.io/v3';
    this.token = this.configService.get<string>('HOSTEX_API_TOKEN') || '';

    if (!this.token) {
      this.logger.error('HOSTEX_API_TOKEN이 설정되지 않았습니다!');
    }
  }

  /**
   * Hostex의 모든 숙소 조회.
   *
   * Hostex API 페이지네이션 진단 결과 (2026-04-25):
   *   - `page` / `per_page` / `size` / `page_size` / `limit`(소)은 전부 무시됨
   *   - `offset` 파라미터 → 작동 (다른 구간 데이터 반환)
   *   - `limit` 파라미터 → 작동 (크기 조절 가능)
   *   - 응답 data.total 에 전체 개수 포함
   *
   * 따라서 offset + limit 조합으로 페이지네이션 구현.
   */
  async fetchAllProperties(): Promise<HostexProperty[]> {
    const allProperties: HostexProperty[] = [];
    const seenIds = new Set<number>();
    const BATCH_SIZE = 100; // limit 값
    const MAX_ITERATIONS = 50; // 안전장치 (최대 5000개)
    let offset = 0;
    let total: number | null = null;
    let iter = 0;

    while (iter < MAX_ITERATIONS) {
      iter++;
      this.logger.log(
        `Fetching properties offset=${offset}, limit=${BATCH_SIZE}...`,
      );

      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/properties`, {
            headers: {
              'Hostex-Access-Token': this.token,
            },
            params: {
              offset,
              limit: BATCH_SIZE,
            },
          }),
        );

        const payload = response.data?.data || {};
        const data: HostexProperty[] = payload.properties || [];

        // 전체 개수 캐치 (첫 요청에서 한 번만)
        if (total === null && typeof payload.total === 'number') {
          total = payload.total;
          this.logger.log(`전체 숙소 수: ${total}개`);
        }

        if (data.length === 0) {
          this.logger.log(`offset=${offset}: 빈 응답, 종료`);
          break;
        }

        // 중복 감지 (안전장치)
        const newProperties = data.filter((p) => !seenIds.has(p.id));

        if (newProperties.length === 0) {
          this.logger.log(
            `offset=${offset}: 새로운 데이터 없음 (중복), 종료`,
          );
          break;
        }

        newProperties.forEach((p) => {
          seenIds.add(p.id);
          allProperties.push(p);
        });

        this.logger.log(
          `offset=${offset}: ${newProperties.length}개 추가 (누적 ${allProperties.length}${
            total ? `/${total}` : ''
          }개)`,
        );

        // total 도달하면 종료
        if (total !== null && allProperties.length >= total) {
          this.logger.log(`전체 ${total}개 수집 완료`);
          break;
        }

        // 받은 데이터가 limit보다 적으면 마지막
        if (data.length < BATCH_SIZE) {
          this.logger.log(`offset=${offset}: 마지막 배치`);
          break;
        }

        offset += data.length;
      } catch (error) {
        this.logger.error(`offset=${offset} 조회 실패:`, error.message);
        throw error;
      }
    }

    this.logger.log(`총 ${allProperties.length}개 숙소 조회 완료`);
    return allProperties;
  }

  /**
   * 특정 숙소 ID로 단건 조회
   */
  async fetchPropertyById(hostexId: number): Promise<HostexProperty | null> {
    const all = await this.fetchAllProperties();
    return all.find((p) => p.id === hostexId) || null;
  }
}