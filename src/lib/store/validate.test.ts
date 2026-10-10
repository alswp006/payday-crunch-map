import { describe, it, expect } from 'vitest';
import { BASE } from '@/test/fixtures';
import {
  MAX_OUTFLOWS,
  isIntInRange,
  isPlainObject,
  normalizeOutflows,
  parseMeta,
  parseOutflow,
  parseOutflowContainer,
  parseSettings,
} from './validate';

const NO_IDS: ReadonlySet<string> = new Set();
const rent = BASE.outflows[0];

describe('isPlainObject / isIntInRange', () => {
  it('일반 객체만 통과한다', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });

  it('범위 안의 정수만 통과한다', () => {
    expect(isIntInRange(1, 1, 31)).toBe(true);
    expect(isIntInRange(31, 1, 31)).toBe(true);
    expect(isIntInRange(0, 1, 31)).toBe(false);
    expect(isIntInRange(32, 1, 31)).toBe(false);
    expect(isIntInRange(1.5, 1, 31)).toBe(false);
    expect(isIntInRange('5', 1, 31)).toBe(false);
    expect(isIntInRange(NaN, 1, 31)).toBe(false);
  });
});

describe('parseSettings', () => {
  it('정상 값은 6개 키만 가진 객체로 돌려준다', () => {
    expect(parseSettings({ ...BASE.settings, extra: 1 })).toStrictEqual(BASE.settings);
  });

  it('경계값: 잔고 0과 9,999,999,999는 통과, 월급 0과 10억+1은 실패', () => {
    expect(parseSettings({ ...BASE.settings, currentBalance: 0 })).not.toBeNull();
    expect(parseSettings({ ...BASE.settings, currentBalance: 9_999_999_999 })).not.toBeNull();
    expect(parseSettings({ ...BASE.settings, currentBalance: -1 })).toBeNull();
    expect(parseSettings({ ...BASE.settings, salaryAmount: 0 })).toBeNull();
    expect(parseSettings({ ...BASE.settings, salaryAmount: 1_000_000_001 })).toBeNull();
  });

  it('version이 1이 아니거나 날짜가 존재하지 않으면 실패', () => {
    expect(parseSettings({ ...BASE.settings, version: 2 })).toBeNull();
    expect(parseSettings({ ...BASE.settings, version: '1' })).toBeNull();
    expect(parseSettings({ ...BASE.settings, balanceAsOf: '2026-02-30' })).toBeNull();
    expect(parseSettings({ ...BASE.settings, salaryWeekendRule: 'skip' })).toBeNull();
    expect(parseSettings([BASE.settings])).toBeNull();
  });
});

describe('parseOutflowContainer', () => {
  it('version 1 + items 배열만 통과한다', () => {
    expect(parseOutflowContainer({ version: 1, items: [] })).toEqual([]);
    expect(parseOutflowContainer([])).toBeNull();
    expect(parseOutflowContainer({ version: 2, items: [] })).toBeNull();
    expect(parseOutflowContainer({ version: 1, items: {} })).toBeNull();
  });
});

describe('parseOutflow', () => {
  it('정상 항목은 dayChange 키 없이 돌려준다', () => {
    const item = parseOutflow({ ...rent, createdAt: 'x' }, NO_IDS);
    expect(item).toStrictEqual(rent);
    expect(item && 'dayChange' in item).toBe(false);
  });

  it('dayChange가 있으면 두 필드까지 검증한다', () => {
    const ok = parseOutflow({ ...rent, dayChange: { fromDay: 24, effectiveMonth: '2026-11' } }, NO_IDS);
    expect(ok?.dayChange).toEqual({ fromDay: 24, effectiveMonth: '2026-11' });
    expect(parseOutflow({ ...rent, dayChange: { fromDay: 0, effectiveMonth: '2026-11' } }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, dayChange: { fromDay: 24, effectiveMonth: '2026-13' } }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, dayChange: null }, NO_IDS)).toBeNull();
  });

  it('id 길이·중복, 이름 trim 길이, 금액·날짜 범위를 본다', () => {
    expect(parseOutflow({ ...rent, id: '' }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, id: 'a'.repeat(33) }, NO_IDS)).toBeNull();
    expect(parseOutflow(rent, new Set(['o-rent']))).toBeNull();
    expect(parseOutflow({ ...rent, name: '   ' }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, name: 'a'.repeat(21) }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, amount: 100_000_001 }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, day: 32 }, NO_IDS)).toBeNull();
    expect(parseOutflow({ ...rent, weekendRule: undefined }, NO_IDS)).toBeNull();
  });
});

describe('normalizeOutflows', () => {
  it('실패한 항목만 걸러 내고 순서를 유지한다', () => {
    const { items, filtered } = normalizeOutflows([rent, { ...BASE.outflows[1], amount: -5 }, BASE.outflows[2]]);
    expect(items.map((o) => o.id)).toEqual(['o-rent', 'o-phone']);
    expect(filtered).toBe(true);
  });

  it('id가 겹치면 먼저 등록한 항목만 남긴다', () => {
    const { items, filtered } = normalizeOutflows([rent, { ...rent, name: '월세2' }]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('월세');
    expect(filtered).toBe(true);
  });

  it('걸러 낸 게 없으면 filtered false', () => {
    expect(normalizeOutflows(BASE.outflows)).toEqual({ items: BASE.outflows, filtered: false });
  });

  it('유효 항목이 상한을 넘으면 앞 30개만 남긴다', () => {
    const many = Array.from({ length: MAX_OUTFLOWS + 1 }, (_, i) => ({ ...rent, id: `o-${i}` }));
    const { items, filtered } = normalizeOutflows(many);
    expect(items).toHaveLength(MAX_OUTFLOWS);
    expect(items[MAX_OUTFLOWS - 1].id).toBe(`o-${MAX_OUTFLOWS - 1}`);
    expect(filtered).toBe(true);
  });

  it('정확히 30개면 걸러 내지 않는다', () => {
    const exact = Array.from({ length: MAX_OUTFLOWS }, (_, i) => ({ ...rent, id: `o-${i}` }));
    expect(normalizeOutflows(exact).filtered).toBe(false);
  });
});

describe('parseMeta', () => {
  it('lastSeenMonth는 null 또는 YearMonth', () => {
    expect(parseMeta({ version: 1, lastSeenMonth: null })).toStrictEqual({ version: 1, lastSeenMonth: null });
    expect(parseMeta({ version: 1, lastSeenMonth: '2026-10', updatedAt: 'x' })).toStrictEqual({
      version: 1,
      lastSeenMonth: '2026-10',
    });
    expect(parseMeta({ version: 1, lastSeenMonth: '2026-13' })).toBeNull();
    expect(parseMeta({ version: 1 })).toBeNull();
    expect(parseMeta({ version: 2, lastSeenMonth: '2026-10' })).toBeNull();
    expect(parseMeta(null)).toBeNull();
  });
});
