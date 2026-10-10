import { describe, expect, it } from 'vitest';
import { BASE, BASE_TODAY } from '@/test/fixtures';

describe('BASE 픽스처', () => {
  it('settings는 SPEC 값과 같다', () => {
    expect(BASE.settings).toEqual({
      version: 1,
      salaryAmount: 2500000,
      salaryDay: 25,
      salaryWeekendRule: 'none',
      currentBalance: 800000,
      balanceAsOf: '2026-10-11',
    });
    expect(BASE_TODAY).toBe(BASE.settings.balanceAsOf);
  });

  it('outflows는 4개가 등록 순서대로 있고 dayChange 키가 없다', () => {
    expect(BASE.outflows.map((o) => [o.id, o.name, o.amount, o.day])).toEqual([
      ['o-rent', '월세', 550000, 24],
      ['o-card', '카드값', 420000, 14],
      ['o-phone', '통신비', 65000, 21],
      ['o-netflix', '넷플릭스', 17000, 18],
    ]);
    for (const item of BASE.outflows) {
      expect(item.weekendRule).toBe('none');
      expect('dayChange' in item).toBe(false);
    }
  });

  it('outflows 금액 합계는 1,052,000이다', () => {
    expect(BASE.outflows.reduce((sum, o) => sum + o.amount, 0)).toBe(1052000);
  });
});

describe('전역 셋업', () => {
  it('localStorage에 쓴 값은 테스트가 끝나면 비워진다 — 쓰기', () => {
    localStorage.setItem('pcm.settings.v1', JSON.stringify(BASE.settings));
    expect(localStorage.length).toBe(1);
  });

  it('localStorage에 쓴 값은 테스트가 끝나면 비워진다 — 확인', () => {
    expect(localStorage.length).toBe(0);
  });

  it('console.error가 호출되면 그 자리에서 throw한다', () => {
    expect(() => console.error('경고')).toThrow(/console\.error/);
  });
});
