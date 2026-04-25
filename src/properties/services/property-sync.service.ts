import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { HostexPropertyService, HostexProperty } from './hostex-property.service';
import { parsePropertyName } from '../utils/property-name.parser';
import { parseGooglePlace } from '../utils/google-place.parser';

export interface PropertySyncResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  durationMs: number;
  errors: Array<{ hostexId: number; error: string }>;
}

@Injectable()
export class PropertySyncService {
  private readonly logger = new Logger(PropertySyncService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly hostexService: HostexPropertyService,
  ) {}

  /**
   * 전체 숙소 동기화
   */
  async syncAll(): Promise<PropertySyncResult> {
    const startTime = Date.now();
    const result: PropertySyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      durationMs: 0,
      errors: [],
    };

    try {
      const hostexProperties = await this.hostexService.fetchAllProperties();
      result.total = hostexProperties.length;

      this.logger.log(`동기화 시작: ${result.total}개 숙소`);

      for (const hostexProp of hostexProperties) {
        try {
          const { isNew } = await this.upsertProperty(hostexProp);
          if (isNew) {
            result.created++;
          } else {
            result.updated++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            hostexId: hostexProp.id,
            error: error.message,
          });
          this.logger.error(
            `숙소 ${hostexProp.id} (${hostexProp.title}) 저장 실패:`,
            error.message,
          );
        }
      }

      result.durationMs = Date.now() - startTime;
      this.logger.log(
        `동기화 완료: 생성 ${result.created}, 업데이트 ${result.updated}, 실패 ${result.failed} (${result.durationMs}ms)`,
      );

      return result;
    } catch (error) {
      result.durationMs = Date.now() - startTime;
      this.logger.error('동기화 전체 실패:', error.message);
      throw error;
    }
  }

  /**
   * 단일 숙소 upsert (hostexId 기준)
   */
  private async upsertProperty(
    hostex: HostexProperty,
  ): Promise<{ property: Property; isNew: boolean }> {
    const existing = await this.propertyRepository.findOne({
      where: { hostexId: hostex.id },
    });

    const mapped = this.mapHostexToEntity(hostex);

    if (existing) {
      // 기존 숙소 업데이트 (수동 입력 필드는 보존)
      Object.assign(existing, mapped, {
        lastSyncedAt: new Date(),
      });
      const saved = await this.propertyRepository.save(existing);
      return { property: saved, isNew: false };
    } else {
      // 신규 생성
      const newProp = this.propertyRepository.create({
        ...mapped,
        lastSyncedAt: new Date(),
      });
      const saved = await this.propertyRepository.save(newProp);
      return { property: saved, isNew: true };
    }
  }

  /**
   * Hostex 데이터 → Property Entity 변환
   */
  private mapHostexToEntity(hostex: HostexProperty): Partial<Property> {
    // 1. 이름 파싱
    const nameParsed = parsePropertyName(hostex.title);

    // 2. 구글 플레이스 파싱
    const placeParsed = parseGooglePlace(hostex.google_place_payload);

    return {
      hostexId: hostex.id,
      title: hostex.title,
      nickname: nameParsed.nickname || undefined,
      buildingName: nameParsed.buildingName || undefined,
      roomNumber: nameParsed.roomNumber || undefined,
      launchStage: nameParsed.launchStage || undefined,
      queenBeds: nameParsed.queenBeds,
      kingBeds: nameParsed.kingBeds,
      doubleBeds: nameParsed.doubleBeds,
      singleBeds: nameParsed.singleBeds,
      totalBeds: nameParsed.totalBeds,
      amenities: nameParsed.amenities,

      // 위치
      address: hostex.address || undefined,
      formattedAddress: placeParsed.formattedAddress || undefined,
      city: placeParsed.city || undefined,
      district: placeParsed.district || undefined,
      neighborhood: placeParsed.neighborhood || undefined,
      postalCode: placeParsed.postalCode || undefined,
      latitude: hostex.latitude || undefined,
      longitude: hostex.longitude || undefined,

      // 이미지
      coverUrl: hostex.cover?.original_url || undefined,
      coverMediumUrl: hostex.cover?.medium_url || undefined,
      coverSmallUrl: hostex.cover?.small_url || undefined,

      // 운영
      checkInTime: hostex.default_checkin_time || undefined,
      checkOutTime: hostex.default_checkout_time || undefined,
      timezone: hostex.timezone || 'Asia/Seoul',

      // WiFi
      wifiSsid: hostex.wifi_ssid || undefined,
      wifiPassword: hostex.wifi_password || undefined,
      wifiRemarks: hostex.wifi_remarks || undefined,

      // 채널
      channels: hostex.channels || [],

      // 상태 기본값
      status: 'active',

      // 원본 보존
      rawData: hostex,
    };
  }
}