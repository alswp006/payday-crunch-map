/**
 * 저장소 어댑터 + save 계열 + probeStorage + id 생성.
 * 렌더하지 않는 순수 저장 로직이라 TDS·router 목을 걸지 않는다.
 * localStorage 실패는 Storage.prototype / window.localStorage를 가로채 재현한다.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BASE } from '@/test/fixtures';
import type { AppMeta, Outflow, PaySettings } from '@/lib/types';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from './keys';
import { classifyStorageError, probeStorage, readRaw, removeKey, writeRaw } from './storage';
import { saveMeta, saveOutflows, saveSettings } from './save';
import { newId } from './id';

const OLD_SETTINGS = '{"version":1,"salaryAmount":1000000}';
const OLD_OUTFLOWS = '{"version":1,"items":[]}';
const OLD_META = '{"version":1,"lastSeenMonth":"2026-09"}';

function seedAllKeys() {
  localStorage.setItem(SETTINGS_KEY, OLD_SETTINGS);
  localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);
  localStorage.setItem(META_KEY, OLD_META);
}

function failSetItem(err: unknown) {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw err;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('save 계열 — 실패 분류', () => {
  it('F1-AC-7: QuotaExceededError면 saveOutflows는 quota를 돌려주고 기존 값을 유지한다', () => {
    localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);
    failSetItem(new DOMException('full', 'QuotaExceededError'));

    expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: 'quota' });
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
  });

  it('F1-AC-7: NS_ERROR_DOM_QUOTA_REACHED 이름과 code 22·1014도 quota다', () => {
    localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);
    const errors = [
      Object.assign(new Error('full'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
      Object.assign(new Error('full'), { code: 22 }),
      Object.assign(new Error('full'), { code: 1014 }),
    ];

    for (const err of errors) {
      failSetItem(err);
      expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: 'quota' });
      vi.restoreAllMocks();
    }
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
  });

  it('F1-AC-9: SecurityError·일반 Error는 세 save 모두 예외 없이 unknown이고 세 키는 그대로다', () => {
    const settings: PaySettings = { ...BASE.settings, currentBalance: 0 };
    const meta: AppMeta = { version: 1, lastSeenMonth: '2026-10' };

    for (const err of [new DOMException('denied', 'SecurityError'), new Error('x')]) {
      seedAllKeys();
      failSetItem(err);

      expect(() => saveSettings(settings)).not.toThrow();
      expect(saveSettings(settings)).toEqual({ ok: false, error: 'unknown' });
      expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: 'unknown' });
      expect(saveMeta(meta)).toEqual({ ok: false, error: 'unknown' });

      expect(localStorage.getItem(SETTINGS_KEY)).toBe(OLD_SETTINGS);
      expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
      expect(localStorage.getItem(META_KEY)).toBe(OLD_META);
      vi.restoreAllMocks();
    }
  });

  it('classifyStorageError: 객체가 아닌 throw 값은 unknown이다', () => {
    expect(classifyStorageError('x')).toBe('unknown');
    expect(classifyStorageError(null)).toBe('unknown');
    expect(classifyStorageError(undefined)).toBe('unknown');
  });
});

describe('probeStorage', () => {
  it('F1-AC-10: 정상이면 true, getter나 getItem이 던지면 false이고 예외를 밖으로 던지지 않는다', () => {
    expect(probeStorage()).toBe(true);

    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      expect(() => probeStorage()).not.toThrow();
      expect(probeStorage()).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => probeStorage()).not.toThrow();
    expect(probeStorage()).toBe(false);

    getItem.mockRestore();
    expect(probeStorage()).toBe(true);
  });

  it('쓰기는 시도하지 않는다', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    probeStorage();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('어댑터', () => {
  it('writeRaw는 키 그대로 JSON 원문을 쓰고 readRaw가 그 원문을, removeKey가 삭제를 처리한다', () => {
    expect(readRaw(META_KEY)).toBeNull();

    writeRaw(META_KEY, { version: 1, lastSeenMonth: null });
    expect(localStorage.getItem(META_KEY)).toBe('{"version":1,"lastSeenMonth":null}');
    expect(readRaw(META_KEY)).toBe('{"version":1,"lastSeenMonth":null}');

    removeKey(META_KEY);
    expect(readRaw(META_KEY)).toBeNull();
  });

  it('readRaw는 손상된 원문도 그대로 돌려준다', () => {
    localStorage.setItem(SETTINGS_KEY, '{broken');
    expect(readRaw(SETTINGS_KEY)).toBe('{broken');
  });

  it('writeRaw·readRaw는 예외를 삼키지 않는다', () => {
    failSetItem(new Error('x'));
    expect(() => writeRaw(META_KEY, {})).toThrow('x');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('y');
    });
    expect(() => readRaw(META_KEY)).toThrow('y');
  });
});

describe('save 계열 — 직렬화', () => {
  it('saveOutflows는 { version: 1, items }로 쓰고 dayChange 없는 항목에 dayChange 키를 쓰지 않는다', () => {
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: true });

    const raw = localStorage.getItem(OUTFLOWS_KEY) as string;
    expect(JSON.parse(raw)).toEqual({ version: 1, items: BASE.outflows });
    expect(raw.split('dayChange')).toHaveLength(1);
  });

  it('saveOutflows는 dayChange가 있으면 두 필드만 쓰고 정의되지 않은 필드는 버린다', () => {
    const items = [
      {
        ...BASE.outflows[1],
        memo: '메모',
        dayChange: { fromDay: 14, effectiveMonth: '2026-11', extra: 1 },
      },
    ] as unknown as Outflow[];

    expect(saveOutflows(items)).toEqual({ ok: true });
    const parsed = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) as string);
    expect(parsed.items[0]).not.toHaveProperty('memo');
    expect(parsed.items[0].dayChange).toEqual({ fromDay: 14, effectiveMonth: '2026-11' });
  });

  it('saveSettings는 6개 키만 쓴다', () => {
    const withExtra = { ...BASE.settings, extra: 1 } as unknown as PaySettings;
    expect(saveSettings(withExtra)).toEqual({ ok: true });

    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) as string);
    expect(Object.keys(parsed)).toHaveLength(6);
    expect(parsed).toEqual(BASE.settings);
  });

  it('saveMeta는 { version: 1, lastSeenMonth }를 쓴다', () => {
    expect(saveMeta({ version: 1, lastSeenMonth: '2026-10' })).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
      version: 1,
      lastSeenMonth: '2026-10',
    });

    expect(saveMeta({ version: 1, lastSeenMonth: null })).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
      version: 1,
      lastSeenMonth: null,
    });
  });

  it('save는 검증하지 않는다 — 범위 밖 값도 그대로 쓴다', () => {
    const odd: PaySettings = { ...BASE.settings, salaryDay: 99 };
    expect(saveSettings(odd)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string).salaryDay).toBe(99);
  });
});

describe('newId', () => {
  it('/^[0-9a-z]{1,32}$/에 맞고 1000회 호출해도 중복이 없으며 crypto.randomUUID를 쓰지 않는다', () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID');

    const ids = Array.from({ length: 1000 }, () => newId());

    expect(ids.every((id) => /^[0-9a-z]{1,32}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(1000);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('Math.random이 항상 같은 값을 돌려줘도 중복이 없다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ids = Array.from({ length: 1000 }, () => newId());
    expect(new Set(ids).size).toBe(1000);
  });
});
