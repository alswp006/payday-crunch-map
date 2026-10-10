import type { DayBalance, DayEvent, LocalDate, Outflow, PaySettings } from '@/lib/types';
import { addDays, addMonths, diffDays, monthOf } from '@/lib/date/localDate';
import { collectEvents, type DayOverride } from '@/lib/balance/events';

/**
 * balanceAsOf부터 endDate까지 하루씩 예상 잔고를 만든다.
 * - balanceAsOf 당일은 이벤트 없이 low = end = currentBalance(이미 반영된 잔고).
 * - (balanceAsOf, endDate] 구간의 이벤트만 반영한다. 같은 날은 출금 먼저, 월급은 나중이다.
 * - today는 이 함수가 쓰지 않는다(범위 판단은 summarizeMonth). 호출부 시그니처를 맞추려고 받는다.
 * - override가 있으면 그 항목의 출금일을 모든 달에서 toDay로 본다(출금일 이동 시뮬레이션).
 * endDate가 balanceAsOf보다 이르면 빈 배열이다.
 */
export function buildProjection(args: {
  settings: PaySettings;
  outflows: Outflow[];
  today: LocalDate;
  endDate: LocalDate;
  override?: DayOverride;
}): DayBalance[] {
  const { settings, outflows, endDate, override } = args;
  const asOf = settings.balanceAsOf;
  const span = diffDays(asOf, endDate);
  if (span < 0) return [];

  // 보정으로 달 경계를 넘는 이벤트까지 잡도록 앞뒤 한 달씩 넓게 만든다.
  const byDate = new Map<LocalDate, DayEvent[]>();
  const events = collectEvents({
    settings,
    outflows,
    fromMonth: addMonths(monthOf(asOf), -1),
    toMonth: addMonths(monthOf(endDate), 1),
    override,
  });
  for (const e of events) {
    if (e.actualDate <= asOf || e.actualDate > endDate) continue;
    const list = byDate.get(e.actualDate);
    if (list) list.push(e);
    else byDate.set(e.actualDate, [e]);
  }

  const days: DayBalance[] = [
    { date: asOf, events: [], lowBalance: settings.currentBalance, endBalance: settings.currentBalance },
  ];
  let balance = settings.currentBalance;
  for (let i = 1; i <= span; i++) {
    const date = addDays(asOf, i);
    const dayEvents = byDate.get(date) ?? [];
    let outflow = 0;
    let salary = 0;
    for (const e of dayEvents) {
      if (e.kind === 'salary') salary += e.amount;
      else outflow += e.amount;
    }
    const lowBalance = balance - outflow;
    const endBalance = lowBalance + salary;
    days.push({ date, events: dayEvents, lowBalance, endBalance });
    balance = endBalance;
  }
  return days;
}
