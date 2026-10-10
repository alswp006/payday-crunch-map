import type { LocalDate, Outflow } from '@/lib/types';
import { addMonths, monthOf, parseYearMonth } from '@/lib/date/localDate';
import { resolveActualDate } from '@/lib/balance/resolveActualDate';

type DayChange = NonNullable<Outflow['dayChange']>;

/**
 * 출금일을 newDay로 바꿀 때의 저장 값을 정한다. 저장은 호출한 쪽이 한다.
 * - 이번 달 기준 날짜 curDay: 아직 적용 전인 dayChange(effectiveMonth > 이번 달)가 있으면 그 fromDay, 아니면 item.day.
 * - 바꾸기 전·후 날짜(말일 보정만, 주말 보정 없음) 중 하나라도 오늘 이전이면 다음 달부터 적용한다.
 * - dayChange 키가 없다는 것이 곧 "변경 시점 없음"이다. undefined 값 키를 만들지 않는다.
 */
export function applyDayChange(
  item: Pick<Outflow, 'name' | 'day' | 'dayChange'>,
  newDay: number,
  today: LocalDate,
): { day: number; dayChange?: Outflow['dayChange'] } {
  const thisMonth = monthOf(today);
  const pending = item.dayChange && item.dayChange.effectiveMonth > thisMonth ? item.dayChange : null;
  const curDay = pending ? pending.fromDay : item.day;

  if (newDay === curDay) return { day: newDay };

  const parsed = parseYearMonth(thisMonth);
  if (!parsed) return { day: newDay };

  const curDate = resolveActualDate(parsed.year, parsed.month, curDay, 'none');
  const newDate = resolveActualDate(parsed.year, parsed.month, newDay, 'none');
  if (curDate <= today || newDate <= today) {
    const dayChange: DayChange = { fromDay: curDay, effectiveMonth: addMonths(thisMonth, 1) };
    return { day: newDay, dayChange };
  }
  return { day: newDay };
}

/**
 * applyDayChange 결과로 저장용 Outflow를 필드별로 새로 만든다.
 * 스프레드로 item과 결과를 병합하지 않는다 — 기존 dayChange가 남아 "변경 취소"가 저장에 반영되지 않는다.
 */
export function applyDayChangeToItem(item: Outflow, newDay: number, today: LocalDate): Outflow {
  const r = applyDayChange(item, newDay, today);
  const next: Outflow = {
    id: item.id,
    name: item.name,
    amount: item.amount,
    weekendRule: item.weekendRule,
    day: r.day,
  };
  if (r.dayChange) {
    next.dayChange = { fromDay: r.dayChange.fromDay, effectiveMonth: r.dayChange.effectiveMonth };
  }
  return next;
}
