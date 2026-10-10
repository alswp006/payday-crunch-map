import type { DayEvent, Outflow, PaySettings, YearMonth } from '@/lib/types';
import { addMonths, monthOf, parseYearMonth, toLocalDate } from '@/lib/date/localDate';
import { resolveActualDate } from '@/lib/balance/resolveActualDate';

/** 출금일 이동 시뮬레이션: 해당 항목을 모든 달에서 toDay로 본다(dayChange는 무시). */
export interface DayOverride {
  itemId: string;
  toDay: number;
}

interface EventArgs {
  settings: PaySettings;
  outflows: Outflow[];
  month: YearMonth;
}

/** 그 달에 쓸 출금일: override가 우선, 그다음 dayChange(effectiveMonth 이상이면 day, 미만이면 fromDay). */
function outflowDayFor(item: Outflow, ym: YearMonth, override?: DayOverride): number {
  if (override && override.itemId === item.id) return override.toDay;
  if (item.dayChange) return ym >= item.dayChange.effectiveMonth ? item.day : item.dayChange.fromDay;
  return item.day;
}

function makeEvent(
  kind: DayEvent['kind'],
  refId: string | null,
  name: string,
  amount: number,
  ym: YearMonth,
  scheduledDay: number,
  rule: PaySettings['salaryWeekendRule'],
): DayEvent {
  const p = parseYearMonth(ym);
  const year = p ? p.year : 0;
  const month = p ? p.month : 1;
  const actualDate = resolveActualDate(year, month, scheduledDay, rule);
  return {
    kind,
    refId,
    name,
    amount,
    scheduledDay,
    actualDate,
    shifted: actualDate !== toLocalDate(year, month, scheduledDay),
  };
}

/**
 * fromMonth ~ toMonth(포함)에 "등록된" 이벤트를 만들어 정렬해 돌려준다.
 * 보정으로 달 경계를 넘을 수 있으니 actualDate 필터는 호출한 쪽이 한다.
 * 정렬: actualDate 오름차순 → 같은 날 출금이 월급보다 먼저 → 출금끼리는 outflows 배열 순서.
 */
export function collectEvents(args: {
  settings: PaySettings;
  outflows: Outflow[];
  fromMonth: YearMonth;
  toMonth: YearMonth;
  override?: DayOverride;
}): DayEvent[] {
  const { settings, outflows, fromMonth, toMonth, override } = args;
  const entries: { event: DayEvent; rank: number; order: number; seq: number }[] = [];

  let seq = 0;
  for (let ym = fromMonth; ym <= toMonth; ym = addMonths(ym, 1)) {
    outflows.forEach((item, index) => {
      const day = outflowDayFor(item, ym, override);
      const event = makeEvent('outflow', item.id, item.name, item.amount, ym, day, item.weekendRule);
      entries.push({ event, rank: 0, order: index, seq: seq++ });
    });
    const salary = makeEvent(
      'salary',
      null,
      '월급',
      settings.salaryAmount,
      ym,
      settings.salaryDay,
      settings.salaryWeekendRule,
    );
    entries.push({ event: salary, rank: 1, order: 0, seq: seq++ });
  }

  entries.sort((a, b) => {
    if (a.event.actualDate !== b.event.actualDate) return a.event.actualDate < b.event.actualDate ? -1 : 1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.order !== b.order) return a.order - b.order;
    return a.seq - b.seq;
  });
  return entries.map((e) => e.event);
}

/**
 * 그 달에 actualDate가 드는 이벤트 전체(월급 포함, balanceAsOf 이전·당일도 포함).
 * 이웃 달에 등록된 항목이 주말 보정으로 이 달로 넘어오는 경우까지 담는다.
 */
export function buildMonthEvents(args: EventArgs): DayEvent[] {
  const { settings, outflows, month } = args;
  return collectEvents({
    settings,
    outflows,
    fromMonth: addMonths(month, -1),
    toMonth: addMonths(month, 1),
  }).filter((e) => monthOf(e.actualDate) === month);
}
