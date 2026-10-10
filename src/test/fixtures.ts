// 공통 테스트 픽스처 'BASE' — SPEC "공통 테스트 픽스처" 값 그대로.
// 테스트에서 바꿔 쓸 때는 `{ ...BASE.settings, currentBalance: 0 }`처럼 복사해서 쓴다.
import type { Outflow, PaySettings } from '@/lib/types';

/** 픽스처 기준 '오늘'(일요일). settings.balanceAsOf와 같다. */
export const BASE_TODAY = '2026-10-11';

const settings: PaySettings = {
  version: 1,
  salaryAmount: 2500000,
  salaryDay: 25,
  salaryWeekendRule: 'none',
  currentBalance: 800000,
  balanceAsOf: '2026-10-11',
};

// 배열 순서 = 등록 순서. dayChange 키는 없다.
const outflows: Outflow[] = [
  { id: 'o-rent', name: '월세', amount: 550000, day: 24, weekendRule: 'none' },
  { id: 'o-card', name: '카드값', amount: 420000, day: 14, weekendRule: 'none' },
  { id: 'o-phone', name: '통신비', amount: 65000, day: 21, weekendRule: 'none' },
  { id: 'o-netflix', name: '넷플릭스', amount: 17000, day: 18, weekendRule: 'none' },
];

export const BASE = { settings, outflows };
