import { describe, it, expect } from 'vitest';
import { BASE } from '@/test/fixtures';
import type { DayBalance, Outflow, PaySettings } from '@/lib/types';
import { resolveActualDate } from '@/lib/balance/resolveActualDate';
import { buildMonthEvents } from '@/lib/balance/events';
import { buildProjection } from '@/lib/balance/projection';
import { summarizeMonth } from '@/lib/balance/summary';

const TODAY = '2026-10-11';
const END = '2026-11-30';

function balanceOn(days: DayBalance[], date: string): DayBalance {
  const found = days.find((d) => d.date === date);
  if (!found) throw new Error(`투영 결과에 ${date}가 없다`);
  return found;
}

describe('balance 코어 (projection)', () => {
  it('BASE 투영은 balanceAsOf부터 endDate까지 하루씩이고, 첫 날은 이벤트 없이 현재 잔고다', () => {
    const days = buildProjection({ settings: BASE.settings, outflows: BASE.outflows, today: TODAY, endDate: END });
    expect(days[0]).toEqual({ date: '2026-10-11', events: [], lowBalance: 800000, endBalance: 800000 });
    expect(days[days.length - 1].date).toBe(END);
    expect(days).toHaveLength(51);
    expect(balanceOn(days, '2026-10-14').endBalance).toBe(380000);
    expect(balanceOn(days, '2026-10-24').endBalance).toBe(-252000);
    expect(balanceOn(days, '2026-10-25').endBalance).toBe(2248000);
  });

  it('endDate가 balanceAsOf보다 이르면 빈 배열, 같으면 하루뿐이다', () => {
    const before = buildProjection({ settings: BASE.settings, outflows: BASE.outflows, today: TODAY, endDate: '2026-10-10' });
    expect(before).toEqual([]);
    const same = buildProjection({ settings: BASE.settings, outflows: BASE.outflows, today: TODAY, endDate: TODAY });
    expect(same).toHaveLength(1);
  });

  it('balanceAsOf 당일 이벤트는 다시 빼지 않는다', () => {
    const outflows: Outflow[] = [{ id: 'o-a', name: '오늘 출금', amount: 50000, day: 11, weekendRule: 'none' }];
    const days = buildProjection({ settings: BASE.settings, outflows, today: TODAY, endDate: '2026-10-12' });
    expect(balanceOn(days, '2026-10-11').endBalance).toBe(800000);
    expect(balanceOn(days, '2026-10-12').endBalance).toBe(800000);
  });

  it('주말 보정으로 이웃 달로 넘어온 이벤트도 반영한다 (11-01 일요일 월급 → 직전 평일 10-30)', () => {
    const settings: PaySettings = { ...BASE.settings, salaryDay: 1, salaryWeekendRule: 'prevBusinessDay' };
    const days = buildProjection({ settings, outflows: [], today: TODAY, endDate: END });
    expect(balanceOn(days, '2026-10-29').endBalance).toBe(800000);
    expect(balanceOn(days, '2026-10-30').endBalance).toBe(3300000);
    const events = buildMonthEvents({ settings, outflows: [], month: '2026-10' });
    // 10월분(10-01)과 11월분이 당겨져 온 10-30이 모두 10월 이벤트다
    expect(events.map((e) => e.actualDate)).toEqual(['2026-10-01', '2026-10-30']);
    expect(events.map((e) => e.shifted)).toEqual([false, true]);
  });

  it('override는 해당 항목만 지정한 날로 옮기고 dayChange를 무시한다', () => {
    const days = buildProjection({
      settings: BASE.settings,
      outflows: BASE.outflows,
      today: TODAY,
      endDate: END,
      override: { itemId: 'o-rent', toDay: 26 },
    });
    // 월세가 월급(25일) 뒤로 가면 10-24는 마이너스가 아니다
    expect(balanceOn(days, '2026-10-24').endBalance).toBe(298000);
    expect(balanceOn(days, '2026-10-25').endBalance).toBe(2798000);
    expect(balanceOn(days, '2026-10-26').endBalance).toBe(2248000);
    const summary = summarizeMonth(days, '2026-10', TODAY);
    expect(summary.firstNegativeDate).toBeNull();
    // 10-21~10-24가 모두 298,000 — 동률이면 가장 이른 날
    expect(summary.lowest).toEqual({ date: '2026-10-21', balance: 298000 });
    expect(summary.crunch).toEqual({ start: '2026-10-21', end: '2026-10-24', days: 4 });
  });

  it('resolveActualDate: 말일 보정 뒤 주말 보정이 달 경계를 넘는다', () => {
    // 2026-10-31 토 → 직후 평일은 11-02(월), 직전 평일은 10-30(금)
    expect(resolveActualDate(2026, 10, 31, 'nextBusinessDay')).toBe('2026-11-02');
    expect(resolveActualDate(2026, 10, 31, 'prevBusinessDay')).toBe('2026-10-30');
    // 2026-11-01 일 → 직전 평일은 10-30
    expect(resolveActualDate(2026, 11, 1, 'prevBusinessDay')).toBe('2026-10-30');
    // 평일은 그대로
    expect(resolveActualDate(2026, 10, 23, 'nextBusinessDay')).toBe('2026-10-23');
    // 2월 30일 → 2월 말일(28일, 일요일) → 직전 평일 2-26
    expect(resolveActualDate(2027, 2, 30, 'prevBusinessDay')).toBe('2027-02-26');
  });

  it('summarizeMonth: 이번 달이 아니면 달 전체, 데이터가 없으면 null', () => {
    const days = buildProjection({ settings: BASE.settings, outflows: BASE.outflows, today: TODAY, endDate: END });
    const nov = summarizeMonth(days, '2026-11', TODAY);
    expect(nov.lowest).toEqual({ date: '2026-11-24', balance: 1196000 });
    expect(nov.crunch).toEqual({ start: '2026-11-24', end: '2026-11-24', days: 1 });
    expect(nov.firstNegativeDate).toBeNull();

    const empty = summarizeMonth([], '2026-10', TODAY);
    expect(empty).toEqual({ month: '2026-10', lowest: null, crunch: null, firstNegativeDate: null });
  });
});
