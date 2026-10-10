/**
 * Packet 0008 테스트: 출금일 이동 시뮬레이션(simulate.ts) + 홈 화면 모델 selector(homeModel.ts).
 *
 * 두 모듈은 순수 함수다(localStorage·React 없음). 날짜는 인자 `today`로 주입되므로 시계를 고정하지 않는다.
 * TDS·react-router·AppState 목도 필요 없다 — 입력 값을 직접 넘겨 결과를 확인한다.
 * 픽스처 BASE는 src/test/fixtures.ts의 SPEC "공통 테스트 픽스처" 값 그대로다.
 *
 * 아직 구현 파일이 없으므로 이 테스트는 red가 정상이다.
 */
import { describe, it, expect } from 'vitest';
import type { Outflow, PaySettings } from '@/lib/types';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { simulateShift, bestShifts } from '@/lib/balance/simulate';
import { buildHomeModel } from '@/lib/balance/homeModel';

const MGMT: Outflow = { id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' };

describe('출금일 이동 시뮬레이션 + 홈 화면 모델 selector', () => {
  it('AC-1[P0]: bestShifts는 월세를 26일로 옮기면 최저 잔고가 -252,000에서 298,000으로 오르고, 카드값은 26일로 옮기면 168,000이 된다', () => {
    const results = bestShifts(BASE.settings, BASE.outflows, BASE_TODAY);
    const rent = results.find((r) => r.itemId === 'o-rent');
    const card = results.find((r) => r.itemId === 'o-card');

    // 26~28일이 동률이고 원래 날짜(24)와의 차가 가장 작은 26일이 선택된다. 25일은 newMin -252,000이라 탈락한다.
    expect(rent).toEqual({
      itemId: 'o-rent',
      name: '월세',
      fromDay: 24,
      toDay: 26,
      baseMin: -252000,
      newMin: 298000,
      delta: 550000,
      improved: true,
    });
    expect(card).toMatchObject({ itemId: 'o-card', fromDay: 14, toDay: 26, newMin: 168000, delta: 420000 });
    expect(card?.improved).toBe(true);
  });

  it('AC-1[P0]: bestShifts 결과 배열은 outflows 배열 순서를 따른다', () => {
    const results = bestShifts(BASE.settings, BASE.outflows, BASE_TODAY);

    expect(results.map((r) => r.itemId)).toEqual(['o-rent', 'o-card', 'o-phone', 'o-netflix']);
    expect(results).toHaveLength(BASE.outflows.length);
  });

  it('AC-2[P0]: simulateShift에서 이미 지난 5일로 옮기면 이번 달은 24일 유지·다음 달 5일 적용이라 delta 0, improved false다', () => {
    const r = simulateShift(BASE.settings, BASE.outflows, 'o-rent', 5, BASE_TODAY);

    expect(r).toMatchObject({ baseMin: -252000, newMin: -252000, delta: 0, improved: false });
    expect(r.toDay).toBe(5);
    expect(r.fromDay).toBe(24);
  });

  it('AC-2[P0]: simulateShift에서 31일을 넣으면 말일 보정으로 10-31·11-30에 반영돼 newMin 298,000, delta 550,000이다', () => {
    const r = simulateShift(BASE.settings, BASE.outflows, 'o-rent', 31, BASE_TODAY);

    expect(r).toMatchObject({ baseMin: -252000, newMin: 298000, delta: 550000, improved: true });
    expect(r.toDay).toBe(31);
    expect(r.improved).toBe(true);
  });

  it('AC-6[P1]: 월세 26일 한 항목뿐이면 bestShifts는 toDay 26, delta 0, improved false를 돌려준다', () => {
    const only: Outflow[] = [{ id: 'o-rent', name: '월세', amount: 550000, day: 26, weekendRule: 'none' }];
    const [r] = bestShifts(BASE.settings, only, BASE_TODAY);

    expect(r).toMatchObject({ itemId: 'o-rent', fromDay: 26, toDay: 26, delta: 0, improved: false });
    expect(r.newMin).toBe(r.baseMin);
  });

  it('AC-3[P0]: buildHomeModel의 10월 rows는 5개이고 첫 두 행이 카드값·넷플릭스이며, 관리비(5일)를 추가하면 6행이고 첫 행이 "지남"이다', () => {
    const base = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: BASE_TODAY, month: '2026-10' });

    expect(base.rows).toHaveLength(5);
    expect(base.rows[0]).toMatchObject({
      label: '10월 14일 (수) 카드값',
      sub: '-420,000원 · 잔고 380,000원',
    });
    expect(base.rows[1]).toMatchObject({
      label: '10월 18일 (일) 넷플릭스',
      sub: '-17,000원 · 잔고 363,000원',
    });

    const withMgmt = buildHomeModel({
      settings: BASE.settings,
      outflows: [...BASE.outflows, MGMT],
      today: BASE_TODAY,
      month: '2026-10',
    });

    expect(withMgmt.rows).toHaveLength(6);
    expect(withMgmt.rows[0]).toMatchObject({
      label: '10월 5일 (월) 관리비',
      sub: '-100,000원 · 지남',
    });
  });

  it('AC-4[P0]: 10월 모델은 leadingBlanks 4·cells 31개이고, 10-10은 잔고를 숨기고 10-11은 800,000을 보인다', () => {
    const model = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: BASE_TODAY, month: '2026-10' });
    const cell = (date: string) => model.cells.find((c) => c.date === date);

    expect(model.leadingBlanks).toBe(4);
    expect(model.cells).toHaveLength(31);
    expect(cell('2026-10-10')?.showBalance).toBe(false);
    expect(cell('2026-10-11')).toMatchObject({ showBalance: true, endBalance: 800000 });
  });

  it('AC-4[P0]: 11월 모델은 leadingBlanks 0·cells 30개이고 11-24 endBalance가 1,196,000이며, today 11-02면 11-02가 2,248,000이고 11-01은 숨긴다', () => {
    const nov = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: BASE_TODAY, month: '2026-11' });
    expect(nov.leadingBlanks).toBe(0);
    expect(nov.cells).toHaveLength(30);
    expect(nov.cells.find((c) => c.date === '2026-11-24')?.endBalance).toBe(1196000);

    const later = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: '2026-11-02', month: '2026-11' });
    expect(later.cells.find((c) => c.date === '2026-11-02')).toMatchObject({ showBalance: true, endBalance: 2248000 });
    expect(later.cells.find((c) => c.date === '2026-11-01')?.showBalance).toBe(false);
  });

  it('AC-5[P0]: today가 2026-12-13(63일 경과)이면 balanceHidden true에 잔고 칸이 0개이고, 12-12(62일)이면 balanceHidden false다', () => {
    const hidden = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: '2026-12-13', month: '2026-12' });
    expect(hidden.balanceHidden).toBe(true);
    expect(hidden.cells.filter((c) => c.showBalance)).toHaveLength(0);

    const shown = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: '2026-12-12', month: '2026-12' });
    expect(shown.balanceHidden).toBe(false);
    expect(shown.cells.some((c) => c.showBalance)).toBe(true);
  });

  it('AC-5[P0]: 주말 보정 변형(월급 prevBusinessDay, 월세 nextBusinessDay)에서 10-21·10-22는 크런치, 10-21은 최저이고, 10월 sparkline은 21점에 최저점 인덱스 13(10-24)이다', () => {
    const settings: PaySettings = { ...BASE.settings, salaryWeekendRule: 'prevBusinessDay' };
    const outflows: Outflow[] = BASE.outflows.map((o) =>
      o.id === 'o-rent' ? { ...o, weekendRule: 'nextBusinessDay' as const } : o,
    );
    const model = buildHomeModel({ settings, outflows, today: BASE_TODAY, month: '2026-10' });
    const cell = (date: string) => model.cells.find((c) => c.date === date);

    expect(cell('2026-10-21')).toMatchObject({ inCrunch: true, isLowest: true });
    expect(cell('2026-10-22')).toMatchObject({ inCrunch: true, isLowest: false });
    expect(cell('2026-10-20')?.inCrunch).toBe(false);

    // 10-11부터 10-31까지 21점, 최저점은 10-24 위치(인덱스 13)
    const base = buildHomeModel({ settings: BASE.settings, outflows: BASE.outflows, today: BASE_TODAY, month: '2026-10' });
    expect(base.sparkline.points).toHaveLength(21);
    expect(base.sparkline.minIndex).toBe(13);
  });
});
