/**
 * 출금일 변경 적용 시점 테스트 (Packet 0007): applyDayChange · applyDayChangeToItem.
 *
 * 두 함수는 순수 함수다(localStorage·React 없음). 그래서 TDS·react-router·AppState 목을 걸지 않고
 * 입력 값을 직접 넘겨 결과를 확인한다. 날짜는 인자로 주입되므로 시계를 고정할 필요가 없다.
 */
import { describe, it, expect } from 'vitest';
import type { Outflow } from '@/lib/types';
import { applyDayChange, applyDayChangeToItem } from '@/lib/balance/dayChange';

const TODAY = '2026-10-11';

/** 카드값 저장 항목: 10일에서 26일로 바꾸는 dayChange가 2026-11부터 걸려 있는 상태 */
const CARD: Outflow = {
  id: 'o-card',
  name: '카드값',
  amount: 420000,
  day: 26,
  weekendRule: 'none',
  dayChange: { fromDay: 10, effectiveMonth: '2026-11' },
};

describe('출금일 변경 적용 시점 (applyDayChange, applyDayChangeToItem)', () => {
  it('AC-1[P0]: 이번 달 날짜가 아직 안 지났으면 applyDayChange는 day만 바꾸고, 지난 날짜면 다음 달부터 적용하는 dayChange를 만든다', () => {
    // 기존 출금일 10일은 10월 11일 기준 이미 지났으므로 변경은 다음 달(2026-11)부터 적용된다
    const r = applyDayChange({ name: '카드값', day: 10 }, 26, TODAY);

    expect(r).toEqual({ day: 26, dayChange: { fromDay: 10, effectiveMonth: '2026-11' } });
    expect(r.day).toBe(26);
    expect(r.dayChange?.effectiveMonth).toBe('2026-11');
  });

  it('AC-2[P0]: 이번 달 기준 날짜가 이미 지났으면(5일) dayChange를 만들고, 안 지났으면(26일) dayChange 키 자체가 없다', () => {
    const passed = applyDayChange({ name: '월세', day: 24 }, 5, TODAY);
    expect(passed).toEqual({ day: 5, dayChange: { fromDay: 24, effectiveMonth: '2026-11' } });
    expect(passed.dayChange?.fromDay).toBe(24);

    const notPassed = applyDayChange({ name: '월세', day: 24 }, 26, TODAY);
    expect(notPassed).toEqual({ day: 26 });
    expect('dayChange' in notPassed).toBe(false);
  });

  it('AC-3[P0]: applyDayChangeToItem은 dayChange가 없으면 키를 넣지 않고, 결과는 id·name·amount·weekendRule·day 다섯 키뿐이다', () => {
    // 카드값 항목을 두 시점에 저장한 결과 — 둘 다 dayChange 키가 없어야 한다
    const afterNov = applyDayChangeToItem(CARD, 27, '2026-11-02');
    const inOct = applyDayChangeToItem(CARD, 10, '2026-10-11');

    expect(Object.keys(afterNov).sort()).toEqual(['amount', 'day', 'id', 'name', 'weekendRule']);
    expect(Object.keys(inOct).sort()).toEqual(['amount', 'day', 'id', 'name', 'weekendRule']);
    expect('dayChange' in afterNov).toBe(false);
    expect('dayChange' in inOct).toBe(false);

    expect(afterNov.day).toBe(27);
    expect(inOct.day).toBe(10);
    expect(afterNov.amount).toBe(420000);
    expect(afterNov.weekendRule).toBe('none');
  });

  it('AC-4[P1]: effectiveMonth가 이번 달보다 뒤인 dayChange가 있을 때 newDay가 day와 같으면 기존 dayChange를 그대로 유지한다', () => {
    // F3-AC-12: 금액만 수정하는 경우 — 날짜는 그대로이므로 예약된 변경이 사라지면 안 된다
    const r = applyDayChangeToItem(CARD, CARD.day, TODAY);

    expect(r.day).toBe(26);
    expect(r.dayChange).toEqual({ fromDay: 10, effectiveMonth: '2026-11' });
    expect(r).toEqual(CARD);
  });
});
