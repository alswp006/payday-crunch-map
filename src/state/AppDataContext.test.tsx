// AppDataContext 보조 테스트 — 핵심 AC는 src/__tests__/packet-0009.test.ts가 다룬다.
// 여기서는 setOutflowDay·없는 id·연속 호출·Provider 밖 사용을 본다.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import type { Outflow, SaveResult } from '@/lib/types';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { OUTFLOWS_KEY } from '@/lib/store/keys';
import { AppDataProvider, useAppData } from '@/state/AppDataContext';

type Ctx = ReturnType<typeof useAppData>;

function mount(): { current: Ctx } {
  const box = { current: undefined as unknown as Ctx };
  function Probe() {
    box.current = useAppData();
    return null;
  }
  render(
    React.createElement(AppDataProvider, null, React.createElement(Probe)),
  );
  return box;
}

function seed() {
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
}

describe('AppDataContext', () => {
  it('setOutflowDay: 이번 달 안에 남은 날짜로 옮기면 바로 적용하고 dayChange 키를 만들지 않는다', async () => {
    seed();
    const ctx = mount();

    let result: SaveResult | undefined;
    await act(async () => {
      result = ctx.current.setOutflowDay('o-rent', 28, BASE_TODAY);
    });

    expect(result).toEqual({ ok: true });
    expect(ctx.current.outflows[0]).toEqual({ ...BASE.outflows[0], day: 28 });
    expect('dayChange' in ctx.current.outflows[0]).toBe(false);
    expect(ctx.current.outflows.slice(1)).toEqual(BASE.outflows.slice(1));
  });

  it('setOutflowDay: 옮기는 날짜가 이미 지났으면 다음 달부터 적용하는 dayChange를 저장한다', async () => {
    seed();
    const ctx = mount();

    // 카드값 14일 → 5일. 5일은 오늘(11일)보다 앞이라 이번 달 값은 14일 그대로 둔다.
    await act(async () => {
      ctx.current.setOutflowDay('o-card', 5, BASE_TODAY);
    });

    const expected: Outflow = {
      ...BASE.outflows[1],
      day: 5,
      dayChange: { fromDay: 14, effectiveMonth: '2026-11' },
    };
    expect(ctx.current.outflows[1]).toEqual(expected);
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? 'null');
    expect(stored.items[1]).toEqual(expected);
  });

  it('없는 id는 상태를 바꾸지 않고 실패 결과를 돌려준다', async () => {
    seed();
    const ctx = mount();
    const before = ctx.current.outflows;

    const results: SaveResult[] = [];
    await act(async () => {
      results.push(ctx.current.removeOutflow('nope'));
      results.push(ctx.current.updateOutflow('nope', { name: '없음' }, 3, BASE_TODAY));
      results.push(ctx.current.setOutflowDay('nope', 3, BASE_TODAY));
    });

    expect(results.every((r) => !r.ok)).toBe(true);
    expect(ctx.current.outflows).toBe(before);
  });

  it('같은 틱에 연달아 부른 add가 서로를 덮어쓰지 않는다', async () => {
    seed();
    const ctx = mount();

    await act(async () => {
      ctx.current.addOutflow({ name: '보험료', amount: 80000, day: 3, weekendRule: 'none' });
      ctx.current.addOutflow({ name: '구독료', amount: 9900, day: 9, weekendRule: 'none' });
    });

    expect(ctx.current.outflows.map((o) => o.name)).toEqual([
      '월세',
      '카드값',
      '통신비',
      '넷플릭스',
      '보험료',
      '구독료',
    ]);
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? 'null');
    expect(stored.items).toHaveLength(6);
  });

  it('Provider 밖에서 useAppData를 쓰면 던진다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Lonely() {
      useAppData();
      return null;
    }
    expect(() => render(React.createElement(Lonely))).toThrow(/AppDataProvider/);
    spy.mockRestore();
  });
});
