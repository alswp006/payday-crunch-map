import { describe, it, expect } from 'vitest';
import { formatWon, formatSignedWon, formatCompactWon, formatKoreanDate } from '@/lib/format';

describe('format', () => {
  it('formatWon은 콤마를 넣고 0·음수를 처리한다', () => {
    expect(formatWon(2500000)).toBe('2,500,000');
    expect(formatWon(0)).toBe('0');
    expect(formatWon(-1000)).toBe('-1,000');
    expect(formatWon(999)).toBe('999');
    expect(formatWon(1000)).toBe('1,000');
  });

  it('formatSignedWon은 항상 부호를 붙이고 0은 부호가 없다', () => {
    expect(formatSignedWon(-252000)).toBe('-252,000원');
    expect(formatSignedWon(550000)).toBe('+550,000원');
    expect(formatSignedWon(0)).toBe('0원');
  });

  it('formatCompactWon은 만·억 경계에서 0 방향으로 자른다', () => {
    expect(formatCompactWon(9800)).toBe('9,800');
    expect(formatCompactWon(9999)).toBe('9,999');
    expect(formatCompactWon(10000)).toBe('1만');
    expect(formatCompactWon(380000)).toBe('38만');
    expect(formatCompactWon(-252000)).toBe('-25.2만');
    expect(formatCompactWon(2248000)).toBe('224.8만');
    expect(formatCompactWon(2249999)).toBe('224.9만');
    expect(formatCompactWon(3300000)).toBe('330만');
    expect(formatCompactWon(99999999)).toBe('9,999.9만');
    expect(formatCompactWon(100000000)).toBe('1억');
    expect(formatCompactWon(123000000)).toBe('1.2억');
    expect(formatCompactWon(-123000000)).toBe('-1.2억');
    expect(formatCompactWon(0)).toBe('0');
    expect(formatCompactWon(-9800)).toBe('-9,800');
  });

  it('formatKoreanDate는 월·일·요일을 붙이고 잘못된 날짜는 그대로 둔다', () => {
    expect(formatKoreanDate('2026-10-24')).toBe('10월 24일 (토)');
    expect(formatKoreanDate('2026-01-05')).toBe('1월 5일 (월)');
    expect(formatKoreanDate('2026-10-11')).toBe('10월 11일 (일)');
    expect(formatKoreanDate('2026-02-30')).toBe('2026-02-30');
  });
});
