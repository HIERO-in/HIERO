export enum LaunchStageType {
  SEARCHING = 'searching',
  VISITING = 'visiting',
  CONTRACTING = 'contracting',
  PAYING = 'paying',
  CLEANING = 'cleaning',
  SETUP = 'setup',
  LISTING = 'listing',
  LIVE = 'live',
}

export const LAUNCH_STAGE_ORDER: Record<LaunchStageType, number> = {
  [LaunchStageType.SEARCHING]: 1,
  [LaunchStageType.VISITING]: 2,
  [LaunchStageType.CONTRACTING]: 3,
  [LaunchStageType.PAYING]: 4,
  [LaunchStageType.CLEANING]: 5,
  [LaunchStageType.SETUP]: 6,
  [LaunchStageType.LISTING]: 7,
  [LaunchStageType.LIVE]: 8,
};

export const LAUNCH_STAGES_IN_ORDER: LaunchStageType[] = [
  LaunchStageType.SEARCHING,
  LaunchStageType.VISITING,
  LaunchStageType.CONTRACTING,
  LaunchStageType.PAYING,
  LaunchStageType.CLEANING,
  LaunchStageType.SETUP,
  LaunchStageType.LISTING,
  LaunchStageType.LIVE,
];

export const LAUNCH_STAGE_LABELS: Record<LaunchStageType, string> = {
  [LaunchStageType.SEARCHING]: '물건탐색',
  [LaunchStageType.VISITING]: '현장확인',
  [LaunchStageType.CONTRACTING]: '계약진행',
  [LaunchStageType.PAYING]: '잔금납부',
  [LaunchStageType.CLEANING]: '청소',
  [LaunchStageType.SETUP]: '셋팅',
  [LaunchStageType.LISTING]: '플랫폼 등록',
  [LaunchStageType.LIVE]: '판매게시',
};
