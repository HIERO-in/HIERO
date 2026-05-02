export class QueryReservationDto {
  from?: string;
  to?: string;
  propertyId?: number;
  channelType?: string;
  status?: string;
  stayStatus?: string;
  search?: string;
  sortBy?: string;       // checkInDate | totalRate | createdAt
  sortDir?: 'asc' | 'desc';
  page?: number;         // 1부터 시작
  limit?: number;        // 기본 50
}
