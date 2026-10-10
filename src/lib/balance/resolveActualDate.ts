import type { LocalDate, WeekendRule } from '@/lib/types';
import { addDays, daysInMonth, toLocalDate, weekday } from '@/lib/date/localDate';

/**
 * 등록한 날짜(year-month-day)를 실제 출금·입금일로 바꾼다.
 * 1) day를 그 달 말일로 보정한다(31일 → 30일·28일).
 * 2) 토·일이면 rule에 따라 직전/직후 평일로 옮긴다. 달 경계를 넘을 수 있다. 공휴일은 보지 않는다.
 * month는 1~12다.
 */
export function resolveActualDate(year: number, month: number, day: number, rule: WeekendRule): LocalDate {
  const clamped = Math.max(1, Math.min(day, daysInMonth(year, month)));
  const date = toLocalDate(year, month, clamped);
  if (rule === 'none') return date;

  const wd = weekday(date);
  if (wd === 6) return addDays(date, rule === 'prevBusinessDay' ? -1 : 2);
  if (wd === 0) return addDays(date, rule === 'prevBusinessDay' ? -2 : 1);
  return date;
}
