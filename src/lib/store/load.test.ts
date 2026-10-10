/**
 * load 계열 보강 테스트 — 패킷 AC는 src/__tests__/packet-0005.test.ts가 다룬다.
 * 여기서는 쓰기·삭제 실패와 정규화 경계를 본다.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BASE } from '@/test/fixtures';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from './keys';
import { loadMeta, loadOutflows, loadSettings } from './load';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadSettings', () => {
  it('추가 필드가 있어도 통과하고 6개 키만 돌려주며 다시 쓰지 않는다', () => {
    const raw = JSON.stringify({ ...BASE.settings, updatedAt: 'x' });
    localStorage.setItem(SETTINGS_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const result = loadSettings();

    expect(result).toStrictEqual({ settings: BASE.settings, recovered: false });
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(raw);
  });

  it('키 삭제가 실패해도 예외 없이 recovered true를 돌려준다', () => {
    localStorage.setItem(SETTINGS_KEY, '{bad');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(loadSettings()).toStrictEqual({ settings: null, recovered: true });
  });
});

describe('loadOutflows', () => {
  it('다시 저장이 실패해도 걸러 낸 값을 돌려준다', () => {
    const items = [BASE.outflows[0], { ...BASE.outflows[1], day: 0 }];
    localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(loadOutflows()).toStrictEqual({ items: [BASE.outflows[0]], recovered: true });
  });

  it('dayChange가 잘못된 항목은 항목 전체를 걸러 낸다', () => {
    const bad = { ...BASE.outflows[1], dayChange: { fromDay: 14, effectiveMonth: 'soon' } };
    const good = { ...BASE.outflows[2], dayChange: { fromDay: 21, effectiveMonth: '2026-09' } };
    localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: [bad, good] }));

    const result = loadOutflows();

    expect(result.recovered).toBe(true);
    expect(result.items).toStrictEqual([good]);
  });

  it('빈 items는 손상이 아니다', () => {
    localStorage.setItem(OUTFLOWS_KEY, '{"version":1,"items":[]}');
    expect(loadOutflows()).toStrictEqual({ items: [], recovered: false });
    expect(localStorage.getItem(OUTFLOWS_KEY)).not.toBeNull();
  });

  it('키가 없으면 recovered false', () => {
    expect(loadOutflows()).toStrictEqual({ items: [], recovered: false });
  });
});

describe('loadMeta', () => {
  it('lastSeenMonth null도 정상이다', () => {
    localStorage.setItem(META_KEY, '{"version":1,"lastSeenMonth":null}');
    expect(loadMeta()).toStrictEqual({ version: 1, lastSeenMonth: null });
  });

  it('lastSeenMonth 형식이 틀려도 키는 지우지 않는다', () => {
    const raw = '{"version":1,"lastSeenMonth":"2026-1"}';
    localStorage.setItem(META_KEY, raw);
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    expect(loadMeta()).toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(META_KEY)).toBe(raw);
  });
});
