import type { DayBalance, DayEvent, LocalDate, MonthSummary, Outflow, PaySettings, YearMonth } from '@/lib/types';
import {
  addMonths,
  daysInMonth,
  diffDays,
  monthOf,
  parseYearMonth,
  toLocalDate,
  weekday,
} from '@/lib/date/localDate';
import { formatKoreanDate, formatSignedWon, formatWon } from '@/lib/format';
import { buildProjection } from '@/lib/balance/projection';
import { buildMonthEvents } from '@/lib/balance/events';
import { summarizeMonth } from '@/lib/balance/summary';

/** 기준일로부터 이만큼(일) 넘게 지나면 예상 잔고를 숨긴다. */
const MAX_STALE_DAYS = 62;

export interface HomeCell {
  date: LocalDate;
  /** 칸에 보일 항목 이름. 최대 1개이고, 나머지 개수는 moreCount다. */
  names: string[];
  moreCount: number;
  /** 잔고 숫자를 그릴지. false면 endBalance가 있어도 그리지 않는다. */
  showBalance: boolean;
  /** 투영에 없는 날(기준일 이전)은 null */
  endBalance: number | null;
  lowBalance: number | null;
  /** 그날 actualDate가 드는 이벤트(기준일 이전 포함) */
  dayEvents: DayEvent[];
  isPast: boolean;
  isNegative: boolean;
  inCrunch: boolean;
  isLowest: boolean;
  /** 날짜 상세를 열 수 있는 칸 — showBalance와 같다 */
  tappable: boolean;
}

export interface HomeRow {
  key: string;
  date: LocalDate;
  kind: DayEvent['kind'];
  /** '10월 14일 (수) 카드값' */
  label: string;
  /** '-420,000원 · 잔고 380,000원' */
  sub: string;
}

export interface HomeSparkline {
  /** 판단 범위의 하루 마감 잔고 */
  points: number[];
  /** 최저 잔고일의 points 인덱스. 없으면 null */
  minIndex: number | null;
}

export interface HomeModel {
  month: YearMonth;
  /** 그 달 1일의 요일(일=0) — 달력 앞쪽 빈 칸 수 */
  leadingBlanks: number;
  cells: HomeCell[];
  rows: HomeRow[];
  summary: MonthSummary;
  sparkline: HomeSparkline;
  /** 기준일이 너무 오래돼 잔고를 숨긴다. 숨기면 summary·sparkline도 비운다. */
  balanceHidden: boolean;
  /** 기준일의 달이 오늘의 달과 다르다 */
  isStale: boolean;
}

function monthEnd(ym: YearMonth): LocalDate {
  const p = parseYearMonth(ym);
  return p ? toLocalDate(p.year, p.month, daysInMonth(p.year, p.month)) : `${ym}-31`;
}

/**
 * 말일 보정만으로 날짜가 바뀐 이벤트에는 "주말이라"를 붙이지 않는다.
 * 등록한 날짜(이웃 달 포함)가 토·일이고 actualDate가 2일 안쪽일 때만 주말 보정이다.
 */
function weekendNote(event: DayEvent, month: YearMonth): string | null {
  if (!event.shifted) return null;
  for (const ym of [addMonths(month, -1), month, addMonths(month, 1)]) {
    const p = parseYearMonth(ym);
    if (!p) continue;
    const registered = toLocalDate(p.year, p.month, Math.min(event.scheduledDay, daysInMonth(p.year, p.month)));
    if (registered === event.actualDate) continue;
    const dow = weekday(registered);
    if ((dow === 0 || dow === 6) && Math.abs(diffDays(registered, event.actualDate)) <= 2) {
      return `주말이라 ${formatKoreanDate(event.actualDate).replace(' (', '(')}로`;
    }
  }
  return null;
}

function buildRow(
  event: DayEvent,
  index: number,
  month: YearMonth,
  asOf: LocalDate,
  today: LocalDate,
  balanceHidden: boolean,
  dayByDate: Map<LocalDate, DayBalance>,
): HomeRow {
  const signed = event.kind === 'salary' ? event.amount : -event.amount;
  const parts: string[] = [formatSignedWon(signed)];

  const day = dayByDate.get(event.actualDate);
  const alreadyApplied = event.actualDate <= asOf;
  if (!alreadyApplied && !balanceHidden && day) parts.push(`잔고 ${formatWon(day.endBalance)}원`);
  if (event.actualDate < today || alreadyApplied) parts.push('지남');

  const note = weekendNote(event, month);
  if (note) parts.push(note);

  return {
    key: `${event.actualDate}:${event.refId ?? 'salary'}:${index}`,
    date: event.actualDate,
    kind: event.kind,
    label: `${formatKoreanDate(event.actualDate)} ${event.name}`,
    sub: parts.join(' · '),
  };
}

/**
 * 홈 화면이 그리는 값을 한 번에 계산한다. 화면은 계산하지 않고 이 값만 그린다.
 * 투영은 기준일부터 max(today 기준 다음 달 말일, 보는 달 말일)까지다.
 */
export function buildHomeModel(args: {
  settings: PaySettings;
  outflows: Outflow[];
  today: LocalDate;
  month: YearMonth;
}): HomeModel {
  const { settings, outflows, today, month } = args;
  const asOf = settings.balanceAsOf;
  const balanceHidden = diffDays(asOf, today) > MAX_STALE_DAYS;
  const isStale = monthOf(asOf) !== monthOf(today);

  const p = parseYearMonth(month);
  if (!p) {
    return {
      month,
      leadingBlanks: 0,
      cells: [],
      rows: [],
      summary: { month, lowest: null, crunch: null, firstNegativeDate: null },
      sparkline: { points: [], minIndex: null },
      balanceHidden,
      isStale,
    };
  }

  const viewStart = toLocalDate(p.year, p.month, 1);
  const viewEnd = monthEnd(month);
  const horizon = monthEnd(addMonths(monthOf(today), 1));
  const endDate = viewEnd > horizon ? viewEnd : horizon;

  const days = buildProjection({ settings, outflows, today, endDate });
  const dayByDate = new Map<LocalDate, DayBalance>();
  for (const d of days) dayByDate.set(d.date, d);

  const events = buildMonthEvents({ settings, outflows, month });
  const eventsByDate = new Map<LocalDate, DayEvent[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.actualDate);
    if (list) list.push(e);
    else eventsByDate.set(e.actualDate, [e]);
  }

  const summary: MonthSummary = balanceHidden
    ? { month, lowest: null, crunch: null, firstNegativeDate: null }
    : summarizeMonth(days, month, today);

  const cells: HomeCell[] = [];
  const total = daysInMonth(p.year, p.month);
  for (let d = 1; d <= total; d++) {
    const date = toLocalDate(p.year, p.month, d);
    const dayEvents = eventsByDate.get(date) ?? [];
    const balance = dayByDate.get(date);
    const showBalance =
      !balanceHidden && balance !== undefined && date >= today && (date > asOf || date === today);
    const crunch = summary.crunch;
    cells.push({
      date,
      names: dayEvents.slice(0, 1).map((e) => e.name),
      moreCount: Math.max(0, dayEvents.length - 1),
      showBalance,
      endBalance: balance ? balance.endBalance : null,
      lowBalance: balance ? balance.lowBalance : null,
      dayEvents,
      isPast: date < today,
      isNegative: showBalance && balance !== undefined && balance.endBalance < 0,
      inCrunch: crunch !== null && date >= crunch.start && date <= crunch.end,
      isLowest: summary.lowest !== null && summary.lowest.date === date,
      tappable: showBalance,
    });
  }

  const rows = events.map((e, i) => buildRow(e, i, month, asOf, today, balanceHidden, dayByDate));

  // summarizeMonth와 같은 판단 범위: 이번 달이면 max(today, 기준일)부터, 그 외는 월초부터
  let rangeStart = viewStart;
  if (monthOf(today) === month) {
    if (today > rangeStart) rangeStart = today;
    if (asOf > rangeStart) rangeStart = asOf;
  }
  const inRange = balanceHidden ? [] : days.filter((d) => d.date >= rangeStart && d.date <= viewEnd);
  const lowestDate = summary.lowest ? summary.lowest.date : null;
  const minIdx = lowestDate === null ? -1 : inRange.findIndex((d) => d.date === lowestDate);

  return {
    month,
    leadingBlanks: weekday(viewStart),
    cells,
    rows,
    summary,
    sparkline: { points: inRange.map((d) => d.endBalance), minIndex: minIdx >= 0 ? minIdx : null },
    balanceHidden,
    isStale,
  };
}
