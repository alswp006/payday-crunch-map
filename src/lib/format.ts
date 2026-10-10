import type { LocalDate } from '@/lib/types';
import { isValidLocalDate, parseLocalDate, weekday } from '@/lib/date/localDate';

// 화면에 보이는 금액·날짜 문자열은 전부 여기서 만든다. 화면에서 직접 반올림·콤마 처리하지 않는다.

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MAN = 10000;
const EOK = 100000000;

/** 정수부에 3자리 콤마를 넣는다. 부호는 호출한 쪽이 처리한다. */
function withCommas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toSafeInt(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 2500000 → '2,500,000', -1000 → '-1,000', 0 → '0' */
export function formatWon(n: number): string {
  const v = toSafeInt(n);
  if (v === 0) return '0';
  return (v < 0 ? '-' : '') + withCommas(Math.abs(v));
}

/** 부호를 항상 붙인 금액: 550000 → '+550,000원', -252000 → '-252,000원', 0 → '0원' */
export function formatSignedWon(n: number): string {
  const v = toSafeInt(n);
  if (v === 0) return '0원';
  return (v > 0 ? '+' : '-') + withCommas(Math.abs(v)) + '원';
}

/**
 * 달력 칸용 축약 금액.
 * |n| < 1만이면 콤마 숫자, < 1억이면 '만', 그 이상은 '억'. 소수 첫째 자리까지 0 방향으로 자르고 '.0'은 지운다.
 * 9800 → '9,800', 380000 → '38만', -252000 → '-25.2만', 2248000 → '224.8만', 123000000 → '1.2억'
 */
export function formatCompactWon(n: number): string {
  const v = toSafeInt(n);
  const abs = Math.abs(v);
  if (abs < MAN) return formatWon(v);

  const unit = abs < EOK ? MAN : EOK;
  const suffix = abs < EOK ? '만' : '억';
  // 정수 연산으로 자른다(부동소수점 오차 방지): 소수 첫째 자리 단위 = unit / 10
  const tenths = Math.floor(abs / (unit / 10));
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  const body = withCommas(whole) + (frac === 0 ? '' : '.' + frac);
  return (v < 0 ? '-' : '') + body + suffix;
}

/** '2026-10-24' → '10월 24일 (토)'. 날짜가 아니면 입력을 그대로 돌려준다. */
export function formatKoreanDate(date: LocalDate): string {
  if (!isValidLocalDate(date)) return date;
  const p = parseLocalDate(date);
  if (!p) return date;
  return `${p.month}월 ${p.day}일 (${WEEKDAY_KO[weekday(date)]})`;
}
