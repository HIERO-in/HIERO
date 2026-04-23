export enum OwnerType {
  OWNED = 'OWNED',           // 자가
  LEASED = 'LEASED',         // 임차
  CONSIGNED = 'CONSIGNED',   // 위탁
  REVENUE_SHARE = 'REVENUE_SHARE', // 배당
}

export enum RevenueBasis {
  GROSS = 'GROSS',
  NET = 'NET',
}

export enum UtilityMode {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

// 프론트 costStorage.js의 UTILITY_ITEMS와 동일 구조
export const UTILITY_KEYS = [
  'management_fee',
  'internet',
  'electric',
  'gas',
  'water',
  'insurance',
  'other_utility',
] as const;

export type UtilityKey = typeof UTILITY_KEYS[number];

export interface UtilityItem {
  mode: UtilityMode;
  amount: number;
}

export type UtilitiesMap = Record<UtilityKey, UtilityItem>;
