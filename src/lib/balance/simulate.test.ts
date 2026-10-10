import { describe, it, expect } from 'vitest';
import type { Outflow } from '@/lib/types';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { simulateShift, bestShifts } from '@/lib/balance/simulate';

describe('simulateShift', () => {
  it('같은 날 출금이 월급보다 먼저 나가므로 25일로 옮기면 최저가 그대로다', () => {
    const r = simulateShift(BASE.settings, BASE.outflows, 'o-rent', 25, BASE_TODAY);
    expect(r).toMatchObject({ baseMin: -252000, newMin: -252000, delta: 0, improved: false });
  });

  it('지금 날짜와 같은 날을 넣으면 변화 없음이다', () => {
    const r = simulateShift(BASE.settings, BASE.outflows, 'o-rent', 24, BASE_TODAY);
    expect(r).toMatchObject({ fromDay: 24, toDay: 24, delta: 0, improved: false });
  });

  it('없는 항목이면 변화 없음을 돌려주고 던지지 않는다', () => {
    const r = simulateShift(BASE.settings, BASE.outflows, 'nope', 10, BASE_TODAY);
    expect(r).toMatchObject({ itemId: 'nope', delta: 0, improved: false, newMin: r.baseMin });
  });

  it('아직 적용 전인 dayChange가 있으면 이번 달 날짜(fromDay)를 원래 날짜로 본다', () => {
    const outflows: Outflow[] = BASE.outflows.map((o) =>
      o.id === 'o-rent' ? { ...o, day: 28, dayChange: { fromDay: 24, effectiveMonth: '2026-11' } } : o,
    );
    const r = simulateShift(BASE.settings, outflows, 'o-rent', 26, BASE_TODAY);
    expect(r.fromDay).toBe(24);
    expect(r.baseMin).toBe(-252000);
    expect(r.newMin).toBe(298000);
  });

  it('출금 30개로 bestShifts를 돌려도 500ms 안에 끝난다', () => {
    const many: Outflow[] = Array.from({ length: 30 }, (_, i) => ({
      id: `o-${i}`,
      name: `항목${i}`,
      amount: 10000 + i * 1000,
      day: (i % 28) + 1,
      weekendRule: 'none' as const,
    }));
    const start = Date.now();
    const results = bestShifts(BASE.settings, many, BASE_TODAY);
    expect(Date.now() - start).toBeLessThan(500);
    expect(results).toHaveLength(30);
  });
});

describe('bestShifts', () => {
  it('나아지지 않는 항목은 toDay = fromDay, delta 0이다', () => {
    const results = bestShifts(BASE.settings, BASE.outflows, BASE_TODAY);
    for (const r of results) {
      expect(r.improved).toBe(r.delta > 0);
      if (!r.improved) expect(r.toDay).toBe(r.fromDay);
    }
  });

  it('출금이 없으면 빈 배열이다', () => {
    expect(bestShifts(BASE.settings, [], BASE_TODAY)).toEqual([]);
  });
});
