import { describe, it, expect } from 'vitest';
import type { Outflow } from '@/lib/types';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { buildHomeModel } from '@/lib/balance/homeModel';

const MGMT: Outflow = { id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' };
const GYM: Outflow = { id: 'o-gym', name: '헬스장', amount: 50000, day: 11, weekendRule: 'none' };

function model(month: string, today = BASE_TODAY, outflows: Outflow[] = BASE.outflows) {
  return buildHomeModel({ settings: BASE.settings, outflows, today, month });
}

describe('buildHomeModel', () => {
  it('10월 rows 5개의 label·sub가 SPEC과 같다', () => {
    const { rows } = model('2026-10');
    expect(rows.map((r) => [r.label, r.sub])).toEqual([
      ['10월 14일 (수) 카드값', '-420,000원 · 잔고 380,000원'],
      ['10월 18일 (일) 넷플릭스', '-17,000원 · 잔고 363,000원'],
      ['10월 21일 (수) 통신비', '-65,000원 · 잔고 298,000원'],
      ['10월 24일 (토) 월세', '-550,000원 · 잔고 -252,000원'],
      ['10월 25일 (일) 월급', '+2,500,000원 · 잔고 2,248,000원'],
    ]);
  });

  it('기준일 이전 항목도 이름으로 보이고 잔고는 다시 빼지 않는다', () => {
    const m = model('2026-10', BASE_TODAY, [...BASE.outflows, MGMT]);
    const cell = (d: string) => m.cells.find((c) => c.date === d);
    expect(cell('2026-10-05')).toMatchObject({ names: ['관리비'], showBalance: false });
    expect(cell('2026-10-14')?.endBalance).toBe(380000);
    expect(m.summary.lowest).toEqual({ date: '2026-10-24', balance: -252000 });
  });

  it('다음 달 rows에 관리비가 잔고와 함께 보인다', () => {
    const { rows } = model('2026-11', BASE_TODAY, [...BASE.outflows, MGMT]);
    const row = rows.find((r) => r.label === '11월 5일 (목) 관리비');
    expect(row?.sub).toBe('-100,000원 · 잔고 2,148,000원');
  });

  it('기준일 당일 이벤트는 잔고 없이 지남으로 표시된다', () => {
    const { rows } = model('2026-10', BASE_TODAY, [...BASE.outflows, GYM]);
    const row = rows.find((r) => r.label === '10월 11일 (일) 헬스장');
    expect(row?.sub).toBe('-50,000원 · 지남');
  });

  it('기준일 이후 오늘 이전 행은 잔고와 지남을 함께 보인다', () => {
    const m = model('2026-11', '2026-11-02');
    const card = m.rows.find((r) => r.label.endsWith('카드값'));
    expect(card?.sub).toBe('-420,000원 · 잔고 1,828,000원');
    const oct = model('2026-10', '2026-10-20');
    const netflix = oct.rows.find((r) => r.label.endsWith('넷플릭스'));
    expect(netflix?.sub).toBe('-17,000원 · 잔고 363,000원 · 지남');
  });

  it('잔고가 숨겨져도 행은 유지되고 sub에 잔고가 없다', () => {
    const visible = model('2026-12', '2026-12-12');
    const hidden = model('2026-12', '2026-12-13');
    expect(hidden.rows).toHaveLength(visible.rows.length);
    expect(hidden.rows.length).toBeGreaterThan(0);
    for (const r of hidden.rows) expect(r.sub).not.toContain('잔고');
    expect(hidden.summary.lowest).toBeNull();
    expect(hidden.sparkline).toEqual({ points: [], minIndex: null });
    expect(hidden.cells.some((c) => c.inCrunch || c.isLowest)).toBe(false);
  });

  it('모든 칸에서 tappable은 showBalance와 같다', () => {
    for (const m of [model('2026-10'), model('2026-11', '2026-11-02'), model('2026-12', '2026-12-13')]) {
      for (const c of m.cells) expect(c.tappable).toBe(c.showBalance);
    }
  });

  it('주말 보정된 항목에는 이동한 날짜를 알려 준다', () => {
    const outflows = BASE.outflows.map((o) =>
      o.id === 'o-rent' ? { ...o, weekendRule: 'nextBusinessDay' as const } : o,
    );
    const rent = model('2026-10', BASE_TODAY, outflows).rows.find((r) => r.label.endsWith('월세'));
    expect(rent?.label).toBe('10월 26일 (월) 월세');
    expect(rent?.sub).toBe('-550,000원 · 잔고 2,248,000원 · 주말이라 10월 26일(월)로');
  });

  it('말일 보정만 일어난 항목에는 주말 문구를 붙이지 않는다', () => {
    const end: Outflow = { id: 'o-end', name: '보험료', amount: 30000, day: 31, weekendRule: 'none' };
    const row = model('2026-11', BASE_TODAY, [end]).rows.find((r) => r.label.endsWith('보험료'));
    expect(row?.label).toBe('11월 30일 (월) 보험료');
    expect(row?.sub).not.toContain('주말');
  });

  it('한 칸에 이름은 1개만 담고 나머지는 moreCount로 센다', () => {
    const same: Outflow[] = [
      { id: 'a', name: '보험료', amount: 1000, day: 20, weekendRule: 'none' },
      { id: 'b', name: '구독', amount: 2000, day: 20, weekendRule: 'none' },
      { id: 'c', name: '적금', amount: 3000, day: 20, weekendRule: 'none' },
    ];
    const cell = model('2026-10', BASE_TODAY, same).cells.find((c) => c.date === '2026-10-20');
    expect(cell?.names).toEqual(['보험료']);
    expect(cell?.moreCount).toBe(2);
    expect(cell?.dayEvents).toHaveLength(3);
  });

  it('기준일의 달이 오늘의 달과 다르면 isStale이다', () => {
    expect(model('2026-10').isStale).toBe(false);
    expect(model('2026-11', '2026-11-02').isStale).toBe(true);
  });

  it('11월 오늘 기준 모델의 최저 잔고일이 11-24다', () => {
    const m = model('2026-11', '2026-11-02');
    expect(m.summary.lowest).toEqual({ date: '2026-11-24', balance: 1196000 });
    expect(m.cells.find((c) => c.date === '2026-11-24')).toMatchObject({ isLowest: true, inCrunch: true });
  });

  it('출금이 없으면 월급만 칸에 보인다', () => {
    const m = model('2026-10', BASE_TODAY, []);
    expect(m.rows).toHaveLength(1);
    expect(m.cells.find((c) => c.date === '2026-10-25')?.names).toEqual(['월급']);
  });

  it('형식이 틀린 달이면 빈 모델을 돌려주고 던지지 않는다', () => {
    const m = model('2026-13');
    expect(m.cells).toEqual([]);
    expect(m.rows).toEqual([]);
  });
});
