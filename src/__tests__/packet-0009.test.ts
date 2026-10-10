/**
 * Packet 0009 테스트: AppDataProvider + useAppData() (src/state/AppDataContext.tsx).
 *
 * 저장·읽기 계층(@/lib/store/save, load)은 실제 구현을 그대로 쓰되, 실패·복구 상황은
 * vi.fn(actual)로 감싼 함수에 mockReturnValueOnce를 걸어 만든다. localStorage는 setup이 매 테스트 비운다.
 * TDS·router는 쓰지 않는 순수 상태 컨텍스트라 목이 필요 없다.
 *
 * 아직 구현 파일이 없으므로 이 테스트는 red가 정상이다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import type { AppMeta, Outflow, PaySettings, SaveResult } from '@/lib/types';
import { BASE } from '@/test/fixtures';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';
import * as save from '@/lib/store/save';
import * as load from '@/lib/store/load';
import { AppDataProvider, useAppData } from '@/state/AppDataContext';

vi.mock('@/lib/store/save', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/store/save')>();
  return {
    ...actual,
    saveSettings: vi.fn(actual.saveSettings),
    saveOutflows: vi.fn(actual.saveOutflows),
    saveMeta: vi.fn(actual.saveMeta),
  };
});

vi.mock('@/lib/store/load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/store/load')>();
  return {
    ...actual,
    loadSettings: vi.fn(actual.loadSettings),
    loadOutflows: vi.fn(actual.loadOutflows),
    loadMeta: vi.fn(actual.loadMeta),
  };
});

type Ctx = ReturnType<typeof useAppData>;

/** 최신 컨텍스트 값을 담는 박스 — current는 렌더마다 갱신된다. */
function mount(): { current: Ctx; renders: () => number } {
  const box = { current: undefined as unknown as Ctx };
  let renders = 0;
  function Probe() {
    box.current = useAppData();
    renders += 1;
    return null;
  }
  render(React.createElement(AppDataProvider, null, React.createElement(Probe)));
  return Object.assign(box, { renders: () => renders });
}

function seed(settings: PaySettings | null = BASE.settings, items: Outflow[] = BASE.outflows) {
  if (settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items }));
}

const FAIL_QUOTA: SaveResult = { ok: false, error: 'quota' };
const FAIL_UNKNOWN: SaveResult = { ok: false, error: 'unknown' };

beforeEach(() => {
  vi.mocked(save.saveSettings).mockClear();
  vi.mocked(save.saveOutflows).mockClear();
  vi.mocked(save.saveMeta).mockClear();
  vi.mocked(load.loadSettings).mockClear();
  vi.mocked(load.loadOutflows).mockClear();
  vi.mocked(load.loadMeta).mockClear();
});

describe('앱 데이터 상태 Context (AppDataProvider + 액션)', () => {
  it('AC-1[P0]: 마운트 시 load 3종을 1번씩만 부르고, addOutflow는 끝에 새 id 항목을 추가해 { version: 1, items }로 저장한다', async () => {
    seed();
    const ctx = mount();

    expect(load.loadSettings).toHaveBeenCalledTimes(1);
    expect(load.loadOutflows).toHaveBeenCalledTimes(1);
    expect(load.loadMeta).toHaveBeenCalledTimes(1);
    expect(ctx.current.settings).toEqual(BASE.settings);
    expect(ctx.current.outflows).toEqual(BASE.outflows);

    let result: SaveResult | undefined;
    await act(async () => {
      result = await ctx.current.addOutflow({ name: '월세', amount: 550000, day: 24, weekendRule: 'none' });
    });

    expect(result).toEqual({ ok: true });
    expect(ctx.current.outflows).toHaveLength(5);
    const added = ctx.current.outflows[4];
    expect(added).toMatchObject({ name: '월세', amount: 550000, day: 24, weekendRule: 'none' });
    expect(added.id).toMatch(/^[0-9a-z]{1,32}$/);
    expect(BASE.outflows.map((o) => o.id)).not.toContain(added.id);
    expect(ctx.current.outflows.slice(0, 4)).toEqual(BASE.outflows);

    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? 'null');
    expect(stored.version).toBe(1);
    expect(stored.items).toHaveLength(5);
    expect(stored.items[4]).toEqual(added);
    // 다시 렌더돼도 load는 추가로 불리지 않는다
    expect(load.loadOutflows).toHaveBeenCalledTimes(1);
  });

  it('AC-2[P0]: saveOutflows가 실패하면 add·update·remove 모두 그 결과를 그대로 돌려주고 outflows는 같은 참조로 남는다', async () => {
    seed();
    const ctx = mount();
    const before = ctx.current.outflows;

    let addResult: SaveResult | undefined;
    vi.mocked(save.saveOutflows).mockReturnValueOnce(FAIL_QUOTA);
    await act(async () => {
      addResult = await ctx.current.addOutflow({ name: '보험료', amount: 80000, day: 3, weekendRule: 'none' });
    });
    expect(addResult).toEqual(FAIL_QUOTA);
    expect(ctx.current.outflows).toBe(before);

    let updateResult: SaveResult | undefined;
    vi.mocked(save.saveOutflows).mockReturnValueOnce(FAIL_UNKNOWN);
    await act(async () => {
      updateResult = await ctx.current.updateOutflow('o-rent', { name: '월세', amount: 600000 }, 26, '2026-10-11');
    });
    expect(updateResult).toEqual(FAIL_UNKNOWN);
    expect(ctx.current.outflows).toBe(before);

    let removeResult: SaveResult | undefined;
    vi.mocked(save.saveOutflows).mockReturnValueOnce(FAIL_QUOTA);
    await act(async () => {
      removeResult = await ctx.current.removeOutflow('o-card');
    });
    expect(removeResult).toEqual(FAIL_QUOTA);
    expect(ctx.current.outflows).toBe(before);
    expect(ctx.current.outflows.map((o) => o.id)).toEqual(['o-rent', 'o-card', 'o-phone', 'o-netflix']);
  });

  it('AC-3[P0]: updateOutflow는 같은 인덱스를 applyDayChangeToItem 결과로 교체하고 나머지 순서를 유지한다', async () => {
    seed();
    const ctx = mount();

    let result: SaveResult | undefined;
    await act(async () => {
      result = await ctx.current.updateOutflow(
        'o-rent',
        { name: '월세(관리비 포함)', amount: 600000 },
        26,
        '2026-10-11',
      );
    });

    expect(result).toEqual({ ok: true });
    expect(ctx.current.outflows[0]).toEqual({
      id: 'o-rent',
      name: '월세(관리비 포함)',
      amount: 600000,
      day: 26,
      weekendRule: 'none',
    });
    expect(ctx.current.outflows.slice(1)).toEqual(BASE.outflows.slice(1));
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? 'null');
    expect(stored.items.map((o: Outflow) => o.id)).toEqual(['o-rent', 'o-card', 'o-phone', 'o-netflix']);
    expect(stored.items[0].day).toBe(26);
  });

  it('AC-3[P0]: removeOutflow는 해당 항목만 빼고 나머지 순서를 유지해 저장한다', async () => {
    seed();
    const ctx = mount();

    let result: SaveResult | undefined;
    await act(async () => {
      result = await ctx.current.removeOutflow('o-card');
    });

    expect(result).toEqual({ ok: true });
    expect(ctx.current.outflows.map((o) => o.id)).toEqual(['o-rent', 'o-phone', 'o-netflix']);
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? 'null');
    expect(stored.items).toHaveLength(3);
  });

  it('AC-4[P0]: saveSettings가 실패하면 settings가 바뀌지 않고, 성공하면 새 settings로 다시 렌더된다', async () => {
    seed();
    const ctx = mount();
    const before = ctx.current.settings;
    const next: PaySettings = { ...BASE.settings, currentBalance: 1200000, salaryAmount: 2800000 };

    let failed: SaveResult | undefined;
    vi.mocked(save.saveSettings).mockReturnValueOnce(FAIL_QUOTA);
    await act(async () => {
      failed = await ctx.current.saveSettings(next);
    });
    expect(failed).toEqual(FAIL_QUOTA);
    expect(ctx.current.settings).toBe(before);
    expect(ctx.current.settings?.currentBalance).toBe(800000);

    let ok: SaveResult | undefined;
    await act(async () => {
      ok = await ctx.current.saveSettings(next);
    });
    expect(ok).toEqual({ ok: true });
    expect(ctx.current.settings).toEqual(next);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    expect(stored.currentBalance).toBe(1200000);
    expect(stored.salaryAmount).toBe(2800000);
  });

  it('AC-5[P1]: loadOutflows가 recovered: true를 돌려주면 outflowsRecovered가 true이고 outflows는 걸러 낸 결과다', () => {
    const filtered: Outflow[] = [BASE.outflows[1], BASE.outflows[2]];
    vi.mocked(load.loadOutflows).mockReturnValueOnce({ items: filtered, recovered: true });
    vi.mocked(load.loadSettings).mockReturnValueOnce({ settings: null, recovered: true });
    const ctx = mount();

    expect(ctx.current.outflowsRecovered).toBe(true);
    expect(ctx.current.outflows).toEqual(filtered);
    expect(ctx.current.settingsRecovered).toBe(true);
    expect(ctx.current.settings).toBeNull();
  });

  it('AC-5[P1]: 정상 데이터면 recovered 플래그는 false이고, 빈 저장소면 settings는 null·outflows는 빈 배열이다', () => {
    seed();
    const ctx = mount();
    expect(ctx.current.settingsRecovered).toBe(false);
    expect(ctx.current.outflowsRecovered).toBe(false);

    localStorage.clear();
    const empty = mount();
    expect(empty.current.settings).toBeNull();
    expect(empty.current.outflows).toEqual([]);
    expect(empty.current.meta).toBeNull();
  });

  it('AC-5[P0]: saveMeta가 실패해도 예외와 console.error 없이 실패 결과를 돌려주고 meta는 그대로다', async () => {
    seed();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = mount();
    const meta: AppMeta = { version: 1, lastSeenMonth: '2026-10' };

    let result: SaveResult | undefined;
    vi.mocked(save.saveMeta).mockReturnValueOnce(FAIL_UNKNOWN);
    await act(async () => {
      result = await ctx.current.saveMeta(meta);
    });
    expect(result).toEqual(FAIL_UNKNOWN);
    expect(ctx.current.meta).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(0);

    await act(async () => {
      result = await ctx.current.saveMeta(meta);
    });
    expect(result).toEqual({ ok: true });
    expect(ctx.current.meta).toEqual(meta);
    expect(JSON.parse(localStorage.getItem(META_KEY) ?? 'null')).toEqual(meta);
    expect(errSpy).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});
