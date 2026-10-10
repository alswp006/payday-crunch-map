/**
 * 읽을 때 검증기 + load 계열 테스트 (Packet 0005).
 *
 * 순수 저장 로직만 다루므로 TDS·react-router·AppState 목을 걸지 않는다(렌더하지 않는다).
 * 검증은 loadSettings / loadOutflows / loadMeta를 통해서만 확인한다(validate.ts 내부 함수에 기대지 않는다).
 * 손상 값은 localStorage.setItem으로 원문 그대로 심는다(writeRaw는 JSON 직렬화를 거치므로 '{bad' 같은 값을 못 쓴다).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BASE } from '@/test/fixtures';
import type { Outflow } from '@/lib/types';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';
import { loadMeta, loadOutflows, loadSettings } from '@/lib/store/load';
import { saveOutflows, saveSettings } from '@/lib/store/save';

/** 원문 그대로 심는다. 문자열은 손상 값 자체, 그 밖은 JSON 직렬화. */
function seed(key: string, value: unknown) {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('읽을 때 검증기 + load 계열 (손상 복구·버전 불일치·30개 상한)', () => {
  it('AC-1: 저장한 설정과 출금 항목을 그대로 불러온다(키 6개, 순서 유지, dayChange 키 없음)', () => {
    expect(saveSettings(BASE.settings)).toEqual({ ok: true });
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: true });

    const settingsResult = loadSettings();
    const outflowsResult = loadOutflows();

    expect(settingsResult).toStrictEqual({ settings: BASE.settings, recovered: false });
    expect(Object.keys(settingsResult.settings ?? {})).toHaveLength(6);
    expect(outflowsResult.recovered).toBe(false);
    expect(outflowsResult.items.map((o) => o.name)).toEqual(['월세', '카드값', '통신비', '넷플릭스']);
    expect(outflowsResult.items.every((o) => !('dayChange' in o))).toBe(true);
  });

  it('AC-2[P1]: 손상되거나 버전이 다른 설정은 null + recovered true이고 키를 지운다. 키가 없으면 recovered false', () => {
    const consoleError = vi.spyOn(console, 'error');
    const broken: unknown[] = [
      '{bad',
      '{"version":1,"salaryDay":"x"}',
      { ...BASE.settings, version: 2 },
      { ...BASE.settings, version: undefined },
      { ...BASE.settings, version: '1' },
      { ...BASE.settings, salaryAmount: 0 },
    ];

    for (const value of broken) {
      localStorage.clear();
      seed(SETTINGS_KEY, value);

      expect(loadSettings()).toStrictEqual({ settings: null, recovered: true });
      expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    }

    localStorage.clear();
    expect(loadSettings()).toStrictEqual({ settings: null, recovered: false });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('AC-3[P1]: 컨테이너가 깨진 출금 키는 { items: [], recovered: true }이고 키를 지운다', () => {
    const broken: unknown[] = [
      '{bad',
      '[]',
      '{"a":1}',
      JSON.stringify(BASE.outflows),
      { version: 2, items: BASE.outflows },
      { version: 1, items: {} },
    ];

    for (const value of broken) {
      localStorage.clear();
      seed(OUTFLOWS_KEY, value);

      expect(loadOutflows()).toStrictEqual({ items: [], recovered: true });
      expect(localStorage.getItem(OUTFLOWS_KEY)).toBeNull();
    }
  });

  it('AC-3[P1]: 넷플릭스(amount -5)만 걸러 내고 나머지 3개를 돌려주며 키를 다시 쓴다. 다음 호출은 recovered false', () => {
    const items = BASE.outflows.map((o) => (o.id === 'o-netflix' ? { ...o, amount: -5 } : o));
    seed(OUTFLOWS_KEY, { version: 1, items });

    const first = loadOutflows();
    expect(first.recovered).toBe(true);
    expect(first.items.map((o) => o.name)).toEqual(['월세', '카드값', '통신비']);
    expect(JSON.parse(localStorage.getItem(OUTFLOWS_KEY) as string)).toEqual({
      version: 1,
      items: BASE.outflows.slice(0, 3),
    });

    const second = loadOutflows();
    expect(second).toStrictEqual({ items: BASE.outflows.slice(0, 3), recovered: false });
  });

  it('AC-3[P1]: 유효한 항목이 31개면 앞 30개만 남기고 다시 저장한다', () => {
    const many: Outflow[] = Array.from({ length: 31 }, (_, i) => ({
      id: `o-${i + 1}`,
      name: `항목${i + 1}`,
      amount: 1000,
      day: 1,
      weekendRule: 'none' as const,
    }));
    seed(OUTFLOWS_KEY, { version: 1, items: many });

    const result = loadOutflows();

    expect(result.recovered).toBe(true);
    expect(result.items).toHaveLength(30);
    expect(result.items[0].id).toBe('o-1');
    expect(result.items[29].id).toBe('o-30');
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) as string);
    expect(stored.version).toBe(1);
    expect(stored.items).toHaveLength(30);
    expect(stored.items[29].id).toBe('o-30');
  });

  it('AC-3[P1]: 정의되지 않은 추가 필드(createdAt)만 있으면 그 필드를 뺀 항목을 돌려주고 키를 다시 쓰지 않는다', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [{ ...BASE.outflows[0], createdAt: '2026-10-01T00:00:00Z' }],
    });
    localStorage.setItem(OUTFLOWS_KEY, raw);

    const result = loadOutflows();

    expect(result).toStrictEqual({ items: [BASE.outflows[0]], recovered: false });
    expect('createdAt' in result.items[0]).toBe(false);
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(raw);
  });

  it('AC-4[P0]: 저장소 접근이 막히면 예외 없이 빈 값을 돌려주고 setItem·removeItem을 부르지 않는다', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toStrictEqual({ settings: null, recovered: false });
    expect(loadOutflows()).toStrictEqual({ items: [], recovered: false });
    expect(loadMeta()).toBeNull();

    expect(getItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('AC-5[P1]: 메타가 없거나 깨졌거나 version 2면 null이고 키를 지우지 않는다', () => {
    const cases: Array<unknown> = [undefined, '{bad', '{"version":2,"lastSeenMonth":"2026-10"}'];

    for (const value of cases) {
      localStorage.clear();
      if (value !== undefined) seed(META_KEY, value);

      expect(loadMeta()).toBeNull();
      expect(localStorage.getItem(META_KEY)).toBe(value === undefined ? null : value);
    }
  });

  it('AC-5[P1]: 추가 필드(updatedAt·createdAt)만 있는 정상 메타는 그 필드를 뺀 값을 돌려주고 키를 다시 쓰지 않는다', () => {
    const raw = '{"version":1,"lastSeenMonth":"2026-10","updatedAt":"2026-10-11T00:00:00Z","createdAt":"2026-09-01"}';
    localStorage.setItem(META_KEY, raw);

    const meta = loadMeta();

    expect(meta).toStrictEqual({ version: 1, lastSeenMonth: '2026-10' });
    expect(localStorage.getItem(META_KEY)).toBe(raw);
  });
});
