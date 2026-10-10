import { describe, it, expect } from 'vitest';
import type { Outflow } from '@/lib/types';
import { applyDayChange, applyDayChangeToItem } from '@/lib/balance/dayChange';

const TODAY = '2026-10-11';

const CARD: Outflow = {
  id: 'o-card',
  name: '카드값',
  amount: 420000,
  day: 26,
  weekendRule: 'none',
  dayChange: { fromDay: 10, effectiveMonth: '2026-11' },
};

describe('applyDayChange', () => {
  it('기존 날짜가 이미 지났으면 다음 달부터 적용하는 dayChange를 만든다', () => {
    expect(applyDayChange({ name: '카드값', day: 10 }, 26, TODAY)).toEqual({
      day: 26,
      dayChange: { fromDay: 10, effectiveMonth: '2026-11' },
    });
  });

  it('새 날짜가 이미 지났으면 다음 달부터 적용한다', () => {
    expect(applyDayChange({ name: '월세', day: 24 }, 5, TODAY)).toEqual({
      day: 5,
      dayChange: { fromDay: 24, effectiveMonth: '2026-11' },
    });
  });

  it('두 날짜 모두 오늘 이후면 dayChange 키가 없다', () => {
    const r = applyDayChange({ name: '월세', day: 24 }, 26, TODAY);
    expect(r).toEqual({ day: 26 });
    expect('dayChange' in r).toBe(false);
  });

  it('적용 전인 기존 dayChange가 있으면 그 fromDay를 유지한다', () => {
    expect(applyDayChange({ name: '카드값', day: 26, dayChange: CARD.dayChange }, 27, TODAY)).toEqual({
      day: 27,
      dayChange: { fromDay: 10, effectiveMonth: '2026-11' },
    });
  });

  it('오늘 당일인 날짜는 지난 것으로 본다', () => {
    expect(applyDayChange({ name: '통신비', day: 11 }, 20, TODAY)).toEqual({
      day: 20,
      dayChange: { fromDay: 11, effectiveMonth: '2026-11' },
    });
  });

  it('12월에는 다음 해 1월부터 적용한다', () => {
    expect(applyDayChange({ name: '월세', day: 3 }, 20, '2026-12-15').dayChange).toEqual({
      fromDay: 3,
      effectiveMonth: '2027-01',
    });
  });

  it('31일 같은 말일 보정 날짜는 그 달 말일로 비교한다', () => {
    // 2026-11-30 기준 31일은 11-30으로 보정돼 오늘과 같으므로 지난 것으로 본다
    expect(applyDayChange({ name: '보험', day: 31 }, 15, '2026-11-30')).toEqual({
      day: 15,
      dayChange: { fromDay: 31, effectiveMonth: '2026-12' },
    });
  });
});

describe('applyDayChangeToItem', () => {
  it('이미 적용된 dayChange는 버리고 키를 넣지 않는다', () => {
    const r = applyDayChangeToItem(CARD, 27, '2026-11-02');
    expect(Object.keys(r).sort()).toEqual(['amount', 'day', 'id', 'name', 'weekendRule']);
    expect(r.day).toBe(27);
    expect('dayChange' in r).toBe(false);
  });

  it('적용 전 fromDay로 되돌리면 변경을 취소한다', () => {
    const r = applyDayChangeToItem(CARD, 10, '2026-10-11');
    expect(Object.keys(r).sort()).toEqual(['amount', 'day', 'id', 'name', 'weekendRule']);
    expect(r.day).toBe(10);
  });

  it('날짜를 바꾸지 않으면 적용 전인 dayChange를 유지한다', () => {
    expect(applyDayChangeToItem(CARD, 26, TODAY)).toEqual(CARD);
  });

  it('입력 객체를 바꾸지 않고 새 객체를 돌려준다', () => {
    const snapshot = JSON.parse(JSON.stringify(CARD));
    const r = applyDayChangeToItem(CARD, 27, '2026-11-02');
    expect(r).not.toBe(CARD);
    expect(CARD).toEqual(snapshot);
  });
});
