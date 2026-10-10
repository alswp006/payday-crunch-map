import type { LocalDate, YearMonth } from '@/lib/types';

// 'YYYY-MM-DD' / 'YYYY-MM' 연산 모음. 문자열 ↔ 숫자 변환은 여기서만 한다.
// 일수 계산은 Date.UTC로 한다(DST·시간대에 흔들리지 않는다). 문자열은 직접 조립한다
// (UTC 문자열 변환은 하루가 밀린다).

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PER_DAY = 86400000;

function pad(n: number, width: number): string {
  let s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

/** 그 달의 일수. month는 1~12. */
export function daysInMonth(year: number, month: number): number {
  // Date.UTC(year, month, 0) = month(1-based)의 말일
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** (y, m, d) → 'YYYY-MM-DD'. 범위 검증은 하지 않는다. */
export function toLocalDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** 'YYYY-MM-DD' → { year, month(1~12), day }. 형식이 틀리면 null. */
export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } | null {
  if (!LOCAL_DATE_RE.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return { year, month, day };
}

/** 'YYYY-MM' → { year, month(1~12) }. 형식이 틀리면 null. */
export function parseYearMonth(ym: YearMonth): { year: number; month: number } | null {
  if (!YEAR_MONTH_RE.test(ym)) return null;
  return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) };
}

/** 형식이 맞고 실제로 존재하는 날짜인가 ('2026-02-30'은 false). */
export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const p = parseLocalDate(value);
  if (!p) return false;
  return p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= daysInMonth(p.year, p.month);
}

/** 'YYYY-MM' 형식이고 월이 01~12인가. */
export function isValidYearMonth(value: unknown): value is YearMonth {
  return typeof value === 'string' && YEAR_MONTH_RE.test(value);
}

/** 날짜 → 그 달 'YYYY-MM'. */
export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7);
}

/** 'YYYY-MM' 더하기 n개월(음수 가능). */
export function addMonths(ym: YearMonth, n: number): YearMonth {
  const p = parseYearMonth(ym);
  if (!p) return ym;
  const index = p.year * 12 + (p.month - 1) + n;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${pad(year, 4)}-${pad(month, 2)}`;
}

function toDayNumber(date: LocalDate): number | null {
  const p = parseLocalDate(date);
  if (!p) return null;
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / MS_PER_DAY);
}

/** 날짜 더하기 n일(음수 가능). 형식이 틀리면 입력을 그대로 돌려준다. */
export function addDays(date: LocalDate, n: number): LocalDate {
  const dayNumber = toDayNumber(date);
  if (dayNumber === null) return date;
  const d = new Date((dayNumber + n) * MS_PER_DAY);
  return toLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** to − from 일수. from이 더 이르면 양수. 형식이 틀리면 0. */
export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = toDayNumber(from);
  const b = toDayNumber(to);
  if (a === null || b === null) return 0;
  return b - a;
}

/** 요일. 일=0 … 토=6. 형식이 틀리면 0. */
export function weekday(date: LocalDate): number {
  const dayNumber = toDayNumber(date);
  if (dayNumber === null) return 0;
  // 1970-01-01은 목요일(4)
  return (((dayNumber + 4) % 7) + 7) % 7;
}
