import { describe, it, expect } from 'vitest';
import {
  toLocalDate,
  parseLocalDate,
  parseYearMonth,
  monthOf,
  addMonths,
  addDays,
  diffDays,
  daysInMonth,
  weekday,
  isValidLocalDate,
  isValidYearMonth,
} from '@/lib/date/localDate';

describe('localDate', () => {
  it('toLocalDate는 0을 채우고 parseLocalDate는 숫자로 되돌린다', () => {
    expect(toLocalDate(2026, 1, 5)).toBe('2026-01-05');
    expect(parseLocalDate('2026-01-05')).toEqual({ year: 2026, month: 1, day: 5 });
    expect(parseLocalDate('2026-1-5')).toBeNull();
    expect(parseYearMonth('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseYearMonth('2026-13')).toBeNull();
    expect(monthOf('2026-10-24')).toBe('2026-10');
  });

  it('daysInMonth는 윤년 2월과 31일/30일 달을 구분한다', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('addDays는 월말·연말·윤년 경계와 음수를 넘는다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-10-11', 0)).toBe('2026-10-11');
    expect(addDays('2026-10-11', 90)).toBe('2027-01-09');
  });

  it('addMonths는 연도를 넘고 음수 달도 처리한다', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 14)).toBe('2027-12');
    expect(addMonths('2026-10', -10)).toBe('2025-12');
    expect(addMonths('2026-10', 0)).toBe('2026-10');
  });

  it('diffDays는 to − from이고 연도를 넘어도 맞다', () => {
    expect(diffDays('2026-10-11', '2026-12-13')).toBe(63);
    expect(diffDays('2026-12-13', '2026-10-11')).toBe(-63);
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(diffDays('2026-10-11', '2026-10-11')).toBe(0);
  });

  it('weekday는 일=0 … 토=6이다', () => {
    expect(weekday('2026-10-24')).toBe(6);
    expect(weekday('2026-10-25')).toBe(0);
    expect(weekday('2026-10-11')).toBe(0);
    expect(weekday('2026-10-12')).toBe(1);
    expect(weekday('2026-10-23')).toBe(5);
  });

  it('isValidLocalDate / isValidYearMonth는 형식과 실존 여부를 본다', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-10-11')).toBe(true);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-00-10')).toBe(false);
    expect(isValidLocalDate('2026-10-00')).toBe(false);
    expect(isValidLocalDate('2026-1-1')).toBe(false);
    expect(isValidLocalDate(20261011)).toBe(false);
    expect(isValidLocalDate(null)).toBe(false);
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-00')).toBe(false);
    expect(isValidYearMonth('2026-12')).toBe(true);
    expect(isValidYearMonth('2026-12-01')).toBe(false);
  });
});
