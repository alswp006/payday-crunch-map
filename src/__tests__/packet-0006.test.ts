/**
 * 잔고 계산 엔진 코어 테스트 (Packet 0006): 날짜 보정·월 이벤트·투영·월 요약.
 *
 * 네 모듈은 전부 순수 함수다(localStorage·React 없음). 그래서 TDS·react-router·AppState 목을 걸지 않고
 * 입력 값을 직접 넘겨 결과를 확인한다. 기준값은 SPEC 공통 픽스처 BASE(today 2026-10-11)다.
 */
import { describe, it, expect } from 'vitest';
import { BASE } from '@/test/fixtures';
import type { DayBalance, Outflow, PaySettings } from '@/lib/types';
import { resolveActualDate } from '@/lib/balance/resolveActualDate';
import { buildMonthEvents } from '@/lib/balance/events';
import { buildProjection } from '@/lib/balance/projection';
import { summarizeMonth } from '@/lib/balance/summary';

const TODAY = '2026-10-11';
const END = '2026-11-30';

/** 투영 결과에서 날짜 한 칸을 꺼낸다. 없으면 테스트를 실패시킨다. */
function balanceOn(days: DayBalance[], date: string): DayBalance {
  const found = days.find((d) => d.date === date);
  if (!found) throw new Error(`투영 결과에 ${date}가 없다`);
  return found;
}

/** 월세의 주말 규칙만 바꾼 출금 목록 */
function withRentRule(rule: 'nextBusinessDay'): Outflow[] {
  return BASE.outflows.map((o) => (o.id === 'o-rent' ? { ...o, weekendRule: rule } : o));
}

describe('잔고 계산 엔진 코어 (날짜 보정·월 이벤트·투영·월 요약)', () => {
  it('AC-1[P0]: BASE 투영의 날짜별 endBalance와 10월 요약(최저일·마이너스 시작일·월급 전 구간)이 SPEC 값과 같다', () => {
    const days = buildProjection({ settings: BASE.settings, outflows: BASE.outflows, today: TODAY, endDate: END });

    expect(balanceOn(days, '2026-10-14').endBalance).toBe(380000);
    expect(balanceOn(days, '2026-10-18').endBalance).toBe(363000);
    expect(balanceOn(days, '2026-10-21').endBalance).toBe(298000);
    expect(balanceOn(days, '2026-10-24').endBalance).toBe(-252000);
    expect(balanceOn(days, '2026-10-25').endBalance).toBe(2248000);
    expect(balanceOn(days, '2026-11-24').endBalance).toBe(1196000);
    expect(balanceOn(days, '2026-11-25').endBalance).toBe(3696000);

    const summary = summarizeMonth(days, '2026-10', TODAY);
    expect(summary.month).toBe('2026-10');
    expect(summary.lowest).toEqual({ date: '2026-10-24', balance: -252000 });
    expect(summary.firstNegativeDate).toBe('2026-10-24');
    expect(summary.crunch).toEqual({ start: '2026-10-24', end: '2026-10-24', days: 1 });
  });

  it('AC-2[P0]: resolveActualDate는 말일 보정 후 주말 보정한다(토·일 → 직전/직후 평일, 말일 초과 → 말일)', () => {
    expect(resolveActualDate(2026, 10, 25, 'prevBusinessDay')).toBe('2026-10-23');
    expect(resolveActualDate(2026, 10, 24, 'nextBusinessDay')).toBe('2026-10-26');
    expect(resolveActualDate(2026, 11, 31, 'none')).toBe('2026-11-30');
    expect(resolveActualDate(2027, 2, 31, 'none')).toBe('2027-02-28');
  });

  it('AC-2[P1]: 월급을 직전 평일로, 월세를 직후 평일로 보정하면 최저 구간이 10-21~10-22이고 월세 이벤트는 shifted다', () => {
    const settings: PaySettings = { ...BASE.settings, salaryWeekendRule: 'prevBusinessDay' };
    const outflows = withRentRule('nextBusinessDay');

    const days = buildProjection({ settings, outflows, today: TODAY, endDate: END });
    const summary = summarizeMonth(days, '2026-10', TODAY);
    expect(summary.lowest).toEqual({ date: '2026-10-21', balance: 298000 });
    expect(summary.crunch).toEqual({ start: '2026-10-21', end: '2026-10-22', days: 2 });
    expect(summary.firstNegativeDate).toBeNull();

    const events = buildMonthEvents({ settings, outflows, month: '2026-10' });
    const rent = events.find((e) => e.refId === 'o-rent');
    expect(rent).toEqual({
      kind: 'outflow',
      refId: 'o-rent',
      name: '월세',
      amount: 550000,
      scheduledDay: 24,
      actualDate: '2026-10-26',
      shifted: true,
    });
  });

  it('AC-3[P0]: 같은 날 출금이 월급보다 먼저 반영된다(10-25 lowBalance −200,000, endBalance 2,300,000)', () => {
    const settings: PaySettings = { ...BASE.settings, currentBalance: 100000 };
    const outflows: Outflow[] = [{ id: 'o-save', name: '적금이체', amount: 300000, day: 25, weekendRule: 'none' }];

    const days = buildProjection({ settings, outflows, today: TODAY, endDate: END });
    const day = balanceOn(days, '2026-10-25');
    expect(day.lowBalance).toBe(-200000);
    expect(day.endBalance).toBe(2300000);

    const summary = summarizeMonth(days, '2026-10', TODAY);
    expect(summary.lowest).toEqual({ date: '2026-10-25', balance: -200000 });
    expect(summary.crunch).toEqual({ start: '2026-10-25', end: '2026-10-25', days: 1 });
  });

  it('AC-4[P1]: 출금이 0개면 최저는 오늘(800,000), 구간은 10-11~10-24 14일, 마이너스 시작일은 null이고 예외가 없다', () => {
    const days = buildProjection({ settings: BASE.settings, outflows: [], today: TODAY, endDate: END });
    expect(balanceOn(days, '2026-10-25').endBalance).toBe(3300000);

    const summary = summarizeMonth(days, '2026-10', TODAY);
    expect(summary.lowest).toEqual({ date: '2026-10-11', balance: 800000 });
    expect(summary.crunch).toEqual({ start: '2026-10-11', end: '2026-10-24', days: 14 });
    expect(summary.firstNegativeDate).toBeNull();
  });

  it('AC-5[P0]: buildMonthEvents(BASE, 2026-10)는 카드값→넷플릭스→통신비→월세→월급 순서의 5개 이벤트다', () => {
    const events = buildMonthEvents({ settings: BASE.settings, outflows: BASE.outflows, month: '2026-10' });

    expect(events.map((e) => [e.name, e.actualDate])).toEqual([
      ['카드값', '2026-10-14'],
      ['넷플릭스', '2026-10-18'],
      ['통신비', '2026-10-21'],
      ['월세', '2026-10-24'],
      ['월급', '2026-10-25'],
    ]);
    expect(events[4]).toEqual({
      kind: 'salary',
      refId: null,
      name: '월급',
      amount: 2500000,
      scheduledDay: 25,
      actualDate: '2026-10-25',
      shifted: false,
    });
  });

  it('AC-5[P0]: 관리비(5일)를 추가해도 balanceAsOf 이전 이벤트는 월 이벤트에만 들어가고 10-14 endBalance는 380,000이다', () => {
    const mgmt: Outflow = { id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' };
    const outflows = [...BASE.outflows, mgmt];

    const events = buildMonthEvents({ settings: BASE.settings, outflows, month: '2026-10' });
    expect(events).toHaveLength(6);
    expect(events[0]).toEqual({
      kind: 'outflow',
      refId: 'o-mgmt',
      name: '관리비',
      amount: 100000,
      scheduledDay: 5,
      actualDate: '2026-10-05',
      shifted: false,
    });

    const days = buildProjection({ settings: BASE.settings, outflows, today: TODAY, endDate: END });
    expect(days.find((d) => d.date === '2026-10-05')).toBeUndefined();
    expect(balanceOn(days, '2026-10-14').endBalance).toBe(380000);
  });

  it('AC-6[P1] (SPEC 설명 규칙): 같은 날이면 출금이 월급보다 먼저, 출금끼리는 배열 순서로 정렬된다', () => {
    const settings: PaySettings = { ...BASE.settings, salaryDay: 10 };
    const outflows: Outflow[] = [
      { id: 'o-a', name: 'A', amount: 1000, day: 10, weekendRule: 'none' },
      { id: 'o-b', name: 'B', amount: 2000, day: 10, weekendRule: 'none' },
    ];

    const events = buildMonthEvents({ settings, outflows, month: '2026-10' });
    expect(events.map((e) => e.name)).toEqual(['A', 'B', '월급']);
    expect(events.map((e) => e.actualDate)).toEqual(['2026-10-10', '2026-10-10', '2026-10-10']);
    expect(events.map((e) => e.kind)).toEqual(['outflow', 'outflow', 'salary']);
  });

  it('AC-6[P1] (SPEC 설명 규칙): dayChange가 있으면 effectiveMonth 전 달은 fromDay, 이후 달은 day를 쓴다', () => {
    // 월세: 10월까지는 24일, 11월부터 26일
    const outflows: Outflow[] = BASE.outflows.map((o) =>
      o.id === 'o-rent' ? { ...o, day: 26, dayChange: { fromDay: 24, effectiveMonth: '2026-11' } } : o,
    );

    const days = buildProjection({ settings: BASE.settings, outflows, today: TODAY, endDate: END });
    expect(balanceOn(days, '2026-10-24').endBalance).toBe(-252000);
    expect(balanceOn(days, '2026-11-24').endBalance).toBe(1746000);
    expect(balanceOn(days, '2026-11-26').endBalance).toBe(3696000);
  });
});
