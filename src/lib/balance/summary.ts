import type { DayBalance, LocalDate, MonthSummary, YearMonth } from '@/lib/types';
import { addDays, daysInMonth, diffDays, monthOf, parseYearMonth, toLocalDate } from '@/lib/date/localDate';

/**
 * 한 달 요약: 최저 잔고일·월급 전 최저 구간·마이너스 시작일.
 * 판단 범위: 이번 달(today의 달)이면 max(today, balanceAsOf, 월초)~월말, 그 외 달은 월 전체.
 * balanceAsOf는 days[0].date다(투영은 거기서 시작한다). days에 없는 날은 범위에서 자연히 빠진다.
 */
export function summarizeMonth(days: DayBalance[], month: YearMonth, today: LocalDate): MonthSummary {
  const p = parseYearMonth(month);
  const monthStart = p ? toLocalDate(p.year, p.month, 1) : `${month}-01`;
  const monthEnd = p ? toLocalDate(p.year, p.month, daysInMonth(p.year, p.month)) : `${month}-31`;

  let rangeStart = monthStart;
  if (monthOf(today) === month) {
    if (today > rangeStart) rangeStart = today;
    const asOf = days.length > 0 ? days[0].date : null;
    if (asOf !== null && asOf > rangeStart) rangeStart = asOf;
  }

  const inRange = days.filter((d) => d.date >= rangeStart && d.date <= monthEnd);

  let lowest: DayBalance | null = null;
  let firstNegativeDate: LocalDate | null = null;
  for (const d of inRange) {
    if (lowest === null || d.lowBalance < lowest.lowBalance) lowest = d;
    if (firstNegativeDate === null && d.lowBalance < 0) firstNegativeDate = d.date;
  }

  if (lowest === null) return { month, lowest: null, crunch: null, firstNegativeDate: null };

  // 최저일 이후 첫 월급의 전날까지. 최저일에 월급이 있으면 그 하루. 월말을 넘으면 월말로 자른다.
  const lowestDate = lowest.date;
  let end: LocalDate = monthEnd;
  if (lowest.events.some((e) => e.kind === 'salary')) {
    end = lowestDate;
  } else {
    const next = days.find((d) => d.date > lowestDate && d.events.some((e) => e.kind === 'salary'));
    if (next) {
      const dayBefore = addDays(next.date, -1);
      if (dayBefore < end) end = dayBefore;
    }
  }

  return {
    month,
    lowest: { date: lowestDate, balance: lowest.lowBalance },
    crunch: { start: lowestDate, end, days: diffDays(lowestDate, end) + 1 },
    firstNegativeDate,
  };
}
