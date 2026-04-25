/**
 * 숙소 운영 유형 (엑셀 '유형' 컬럼과 1:1 매핑)
 *
 * - 단기임대: 일반적인 임차 후 단기임대 운영
 * - 대위변제: 대위변제 사건으로 확보한 숙소
 * - 전세: 전세 임차 후 운영
 * - 경매: 경매로 확보
 * - 남의집: 타인 소유 / 위탁 운영
 */
export enum OwnershipType {
  SHORT_TERM_LEASE = '단기임대',
  SUBROGATION = '대위변제',
  CHEONSE = '전세',
  AUCTION = '경매',
  OTHERS_HOUSE = '남의집',
}
