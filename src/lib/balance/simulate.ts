import type { LocalDate, Outflow, PaySettings, SimResult, YearMonth } from '@/lib/types';
import { addMonths, daysInMonth, monthOf, parseYearMonth, toLocalDate } from '@/lib/date/localDate';
import { buildProjection } from '@/lib/balance/projection';
import { resolveActualDate } from '@/lib/balance/resolveActualDate';

/** 추천 후보일 상한. 29~31일은 달마다 처리 날짜가 달라 추천에서 뺀다(직접 입력으로만 비교). */
const MAX_CANDIDATE_DAY = 28;

function monthEnd(ym: YearMonth): LocalDate {
  const p = parseYearMonth(ym);
  return p ? toLocalDate(p.year, p.month, daysInMonth(p.year, p.month)) : `${ym}-31`;
}

/** 저장된 dayChange를 따라 그 달에 쓰는 출금일(events.ts의 규칙과 같다). */
function dayFor(item: Outflow, ym: YearMonth): number {
  if (item.dayChange) return ym >= item.dayChange.effectiveMonth ? item.day : item.dayChange.fromDay;
  return item.day;
}

/** 시뮬레이션 구간(today ~ 다음 달 말일)의 lowBalance 최솟값. */
function minLowBalance(settings: PaySettings, outflows: Outflow[], today: LocalDate): number {
  const endDate = monthEnd(addMonths(monthOf(today), 1));
  const days = buildProjection({ settings, outflows, today, endDate });
  let min: number | null = null;
  for (const d of days) {
    if (d.date < today) continue;
    if (min === null || d.lowBalance < min) min = d.lowBalance;
  }
  return min ?? settings.currentBalance;
}

/**
 * item의 출금일을 toDay로 옮긴 outflows 사본을 만든다.
 * 이번 달의 원래 날짜와 새 날짜(주말 보정 후)가 모두 today 뒤일 때만 이번 달부터 새 날짜를 쓴다.
 * 그렇지 않으면 이번 달은 원래 날짜를 유지하고 다음 달부터 적용한다.
 * 이번 달 이전 달은 어느 쪽이든 기존 날짜 그대로다(지난 이벤트가 잔고 이월을 바꾸면 안 된다).
 */
function withShiftedItem(outflows: Outflow[], item: Outflow, toDay: number, today: LocalDate): Outflow[] {
  const thisMonth = monthOf(today);
  const p = parseYearMonth(thisMonth);
  const curDay = dayFor(item, thisMonth);

  let shifted: Outflow;
  if (!p) {
    shifted = { id: item.id, name: item.name, amount: item.amount, weekendRule: item.weekendRule, day: toDay };
  } else {
    const curDate = resolveActualDate(p.year, p.month, curDay, item.weekendRule);
    const newDate = resolveActualDate(p.year, p.month, toDay, item.weekendRule);
    const applyNow = curDate > today && newDate > today;
    shifted = {
      ...item,
      day: toDay,
      dayChange: applyNow
        ? { fromDay: dayFor(item, addMonths(thisMonth, -1)), effectiveMonth: thisMonth }
        : { fromDay: curDay, effectiveMonth: addMonths(thisMonth, 1) },
    };
  }
  return outflows.map((o) => (o.id === item.id ? shifted : o));
}

function noChange(item: Outflow | undefined, itemId: string, fromDay: number, baseMin: number): SimResult {
  return {
    itemId,
    name: item ? item.name : '',
    fromDay,
    toDay: fromDay,
    baseMin,
    newMin: baseMin,
    delta: 0,
    improved: false,
  };
}

function shiftResult(
  settings: PaySettings,
  outflows: Outflow[],
  item: Outflow,
  fromDay: number,
  toDay: number,
  today: LocalDate,
  baseMin: number,
): SimResult {
  const newMin = minLowBalance(settings, withShiftedItem(outflows, item, toDay, today), today);
  const delta = newMin - baseMin;
  return { itemId: item.id, name: item.name, fromDay, toDay, baseMin, newMin, delta, improved: delta > 0 };
}

/**
 * 출금일을 toDay(1~31)로 옮겼을 때의 최저 잔고 변화.
 * 구간은 today부터 today가 속한 달의 다음 달 말일까지다. 항목을 못 찾으면 변화 없음을 돌려준다.
 */
export function simulateShift(
  settings: PaySettings,
  outflows: Outflow[],
  itemId: string,
  toDay: number,
  today: LocalDate,
): SimResult {
  const baseMin = minLowBalance(settings, outflows, today);
  const item = outflows.find((o) => o.id === itemId);
  if (!item) return noChange(undefined, itemId, toDay, baseMin);

  const fromDay = dayFor(item, monthOf(today));
  if (toDay === fromDay) return noChange(item, itemId, fromDay, baseMin);
  return shiftResult(settings, outflows, item, fromDay, toDay, today, baseMin);
}

/**
 * 항목마다 후보 1~28일(원래 날짜 제외) 중 최저 잔고가 가장 높아지는 날을 고른다.
 * 동률이면 원래 날짜와의 차가 작은 날, 그다음 이른 날. 나아지지 않으면 toDay = fromDay, delta 0.
 * 결과 순서는 outflows 배열 순서다(정렬은 화면이 정한다).
 */
export function bestShifts(settings: PaySettings, outflows: Outflow[], today: LocalDate): SimResult[] {
  const baseMin = minLowBalance(settings, outflows, today);
  const thisMonth = monthOf(today);

  return outflows.map((item) => {
    const fromDay = dayFor(item, thisMonth);
    let best: SimResult | null = null;
    for (let day = 1; day <= MAX_CANDIDATE_DAY; day++) {
      if (day === fromDay) continue;
      const r = shiftResult(settings, outflows, item, fromDay, day, today, baseMin);
      if (best === null || r.newMin > best.newMin) {
        best = r;
      } else if (r.newMin === best.newMin) {
        const rGap = Math.abs(day - fromDay);
        const bestGap = Math.abs(best.toDay - fromDay);
        if (rGap < bestGap || (rGap === bestGap && day < best.toDay)) best = r;
      }
    }
    if (best === null || best.delta <= 0) return noChange(item, item.id, fromDay, baseMin);
    return best;
  });
}
