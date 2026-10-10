/**
 * Packet 0014 테스트: 잔고 달력 그리드 + 날짜 상세 시트.
 *   - src/components/home/CalendarGrid.tsx   → CalendarGrid({ model, onDayClick })
 *   - src/components/home/DayDetailSheet.tsx → DayDetailSheet({ open, cell, onClose })
 * 아직 구현 파일이 없으므로 red가 정상이다.
 *
 * 계약(코더가 이 테스트로 읽는 것):
 *  - model은 buildHomeModel()의 HomeModel이다. 그리드는 계산하지 않고 model.cells·leadingBlanks만 그린다.
 *  - data-testid="calendar-grid"의 직접 자식은 머리줄 7칸 + 앞쪽 빈칸(leadingBlanks) + 날짜 칸 순서이고,
 *    calendar-grid 자체는 Card 안에 있다(Card가 아닌 7열 grid 요소에 testid).
 *  - 날짜 칸은 data-testid="day-cell-YYYY-MM-DD" 요소 하나이고 그 요소가 탭 대상이다(cell.tappable일 때만 onDayClick(cell)).
 *    칸 안에는 날짜 숫자(예: '24'), 항목 이름(최대 1개), '+N', formatCompactWon 잔고가 각각 자기 요소로 있다.
 *  - 색은 Paragraph.Text color(목에서는 data-color) 또는 style.color로 'var(--adaptive…)' 값이다.
 *  - data-crunch / data-lowest 는 'true' | 'false' 문자열로 칸에 붙는다.
 *  - DayDetailSheet는 open일 때 제목 'M월 D일 (요일)', 그날 이벤트 행, '하루 마감 잔고 …원',
 *    lowBalance가 endBalance와 다르면 '출금 후 최저 …원'을 보인다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { buildHomeModel } from '@/lib/balance/homeModel';
import type { HomeCell, HomeModel } from '@/lib/balance/homeModel';
import type { Outflow, PaySettings } from '@/lib/types';
import { CalendarGrid } from '@/components/home/CalendarGrid';
import { DayDetailSheet } from '@/components/home/DayDetailSheet';

mockTds();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
});

const MGMT: Outflow = { id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' };
const INSURANCE: Outflow = { id: 'o-ins', name: '보험료', amount: 30000, day: 24, weekendRule: 'none' };

function modelFor(settings: PaySettings, outflows: Outflow[], month = '2026-10'): HomeModel {
  return buildHomeModel({ settings, outflows, today: BASE_TODAY, month });
}

type GridProps = { model: HomeModel; onDayClick?: (cell: HomeCell) => void };
type SheetProps = { open: boolean; cell: HomeCell | null; onClose: () => void };

// 그리드 + 시트를 홈 화면처럼 엮은 하네스: 칸을 탭하면 그 칸의 시트가 열린다.
function Harness({ model, onDayClick }: GridProps) {
  const [cell, setCell] = useState<HomeCell | null>(null);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(CalendarGrid as unknown as React.ComponentType<GridProps>, {
      model,
      onDayClick: (c: HomeCell) => {
        onDayClick?.(c);
        setCell(c);
      },
    }),
    React.createElement(DayDetailSheet as unknown as React.ComponentType<SheetProps>, {
      open: cell !== null,
      cell,
      onClose: () => setCell(null),
    }),
  );
}

function renderHarness(model: HomeModel, onDayClick?: (cell: HomeCell) => void) {
  return render(
    React.createElement(MemoryRouter, null, React.createElement(Harness, { model, onDayClick })),
  );
}

function cellEl(date: string): HTMLElement {
  return screen.getByTestId(`day-cell-${date}`);
}

/** Paragraph.Text 목은 color를 data-color로, 실제 TDS·일반 요소는 style.color로 남긴다. */
function colorOf(el: HTMLElement): string {
  return el.getAttribute('data-color') || el.style.getPropertyValue('color') || el.style.color;
}

describe('잔고 달력 그리드 + 날짜 상세 시트', () => {
  it('F4-AC-1[P0]: 10-24 칸에 월세와 -25.2만이 보이고 금액은 Red500이다', () => {
    renderHarness(modelFor(BASE.settings, BASE.outflows));
    const cell = cellEl('2026-10-24');

    expect(within(cell).getByText('월세')).toBeInTheDocument();
    const amount = within(cell).getByText('-25.2만');
    expect(colorOf(amount)).toBe('var(--adaptiveRed500)');
    // 양수 잔고는 Red가 아니다
    expect(colorOf(within(cellEl('2026-10-14')).getByText('38만'))).not.toBe('var(--adaptiveRed500)');
  });

  it('F4-AC-1[P0]: 한 칸에 이름은 1개만 보이고 나머지는 +N이다', () => {
    renderHarness(modelFor(BASE.settings, [...BASE.outflows, INSURANCE]));
    const cell = cellEl('2026-10-24');

    expect(within(cell).getByText('월세')).toBeInTheDocument();
    expect(within(cell).queryByText('보험료')).toBeNull();
    expect(within(cell).getByText('+1')).toBeInTheDocument();
    // 이름이 하나뿐인 칸에는 +N이 없다
    expect(within(cellEl('2026-10-14')).queryByText(/^\+\d+$/)).toBeNull();
  });

  it('F4-AC-2[P0]: calendar-grid는 Card 안에 있고 머리줄·빈칸·날짜 칸 수가 맞다', () => {
    renderHarness(modelFor(BASE.settings, BASE.outflows));
    const grid = screen.getByTestId('calendar-grid');

    // Card = 16px 라운드 컨테이너(Card.tsx). grid 자신이 아니라 조상 중에 있어야 한다.
    let card: HTMLElement | null = grid.parentElement;
    while (card && card.style.borderRadius !== '16px') card = card.parentElement;
    expect(card).not.toBeNull();

    const children = Array.from(grid.children);
    expect(children.slice(0, 7).map((c) => c.textContent)).toEqual(['일', '월', '화', '수', '목', '금', '토']);

    const dayCells = screen.getAllByTestId(/^day-cell-/);
    expect(dayCells).toHaveLength(31);
    // 10-01은 목요일 → 앞쪽 빈칸 4개
    expect(children.length - 7 - dayCells.length).toBe(4);
    expect(children[7 + 4]).toBe(cellEl('2026-10-01'));
  });

  it('F4-AC-2[P0]: 지난 날은 Grey400이고 잔고가 없으며, 10-11 이후에는 compact 잔고가 있다', () => {
    renderHarness(modelFor(BASE.settings, BASE.outflows));

    for (let d = 1; d <= 10; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      const cell = cellEl(date);
      expect(colorOf(within(cell).getByText(String(d)))).toBe('var(--adaptiveGrey400)');
      expect(cell.textContent).not.toMatch(/만|,/);
    }
    expect(within(cellEl('2026-10-11')).getByText('80만')).toBeInTheDocument();
    expect(within(cellEl('2026-10-14')).getByText('38만')).toBeInTheDocument();
    expect(within(cellEl('2026-10-25')).getByText('224.8만')).toBeInTheDocument();
  });

  it('F4-AC-10[P0]: 기준일 이전 항목 관리비는 Grey400 이름만 보이고 잔고 숫자는 없다', () => {
    renderHarness(modelFor(BASE.settings, [...BASE.outflows, MGMT]));
    const cell = cellEl('2026-10-05');

    const name = within(cell).getByText('관리비');
    expect(colorOf(name)).toBe('var(--adaptiveGrey400)');
    expect(cell.textContent).not.toMatch(/만|,/);
  });

  it('F4-AC-10[P0]: 잔고가 없는 지난 칸은 탭해도 onDayClick·시트가 열리지 않는다', () => {
    const onDayClick = vi.fn();
    renderHarness(modelFor(BASE.settings, [...BASE.outflows, MGMT]), onDayClick);

    fireEvent.click(cellEl('2026-10-05'));

    expect(onDayClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('F4-AC-4[P1]: 10-24를 탭하면 제목·월세 행·마감 잔고가 시트에 보인다', () => {
    const onDayClick = vi.fn();
    renderHarness(modelFor(BASE.settings, BASE.outflows), onDayClick);

    fireEvent.click(cellEl('2026-10-24'));

    expect(onDayClick).toHaveBeenCalledTimes(1);
    expect(onDayClick.mock.calls[0][0]).toMatchObject({ date: '2026-10-24', endBalance: -252000 });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('10월 24일 (토)')).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/월세\s*-550,000원/);
    expect(within(dialog).getByText('하루 마감 잔고 -252,000원')).toBeInTheDocument();
    // lowBalance == endBalance → 최저 줄 없음
    expect(within(dialog).queryByText(/출금 후 최저/)).toBeNull();
  });

  it('F4-AC-4[P1]: 이벤트가 없는 10-12는 안내 문구와 마감 잔고 800,000원을 보인다', () => {
    renderHarness(modelFor(BASE.settings, BASE.outflows));

    fireEvent.click(cellEl('2026-10-12'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('이날은 출금·입금이 없어요')).toBeInTheDocument();
    expect(within(dialog).getByText('하루 마감 잔고 800,000원')).toBeInTheDocument();
    expect(within(dialog).getByText('10월 12일 (월)')).toBeInTheDocument();
  });

  it('F4-AC-4[P1]: 같은 날 출금이 월급보다 먼저 나가면 출금 후 최저 줄이 추가된다', () => {
    const settings = { ...BASE.settings, currentBalance: 100000 };
    const save: Outflow = { id: 'o-save', name: '적금이체', amount: 300000, day: 25, weekendRule: 'none' };
    renderHarness(modelFor(settings, [save]));

    fireEvent.click(cellEl('2026-10-25'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('출금 후 최저 -200,000원')).toBeInTheDocument();
    expect(within(dialog).getByText('하루 마감 잔고 2,300,000원')).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/적금이체\s*-300,000원/);
  });

  it('F5-AC-2[P0]: 크런치 칸에 data-crunch가, 최저일 칸에 data-lowest가 붙는다', () => {
    const settings: PaySettings = { ...BASE.settings, salaryWeekendRule: 'prevBusinessDay' };
    const outflows = BASE.outflows.map((o) =>
      o.id === 'o-rent' ? { ...o, weekendRule: 'nextBusinessDay' as const } : o,
    );
    renderHarness(modelFor(settings, outflows));

    expect(cellEl('2026-10-21')).toHaveAttribute('data-crunch', 'true');
    expect(cellEl('2026-10-22')).toHaveAttribute('data-crunch', 'true');
    expect(cellEl('2026-10-21')).toHaveAttribute('data-lowest', 'true');
    // 구간 밖·최저일이 아닌 칸
    expect(cellEl('2026-10-22')).toHaveAttribute('data-lowest', 'false');
    expect(cellEl('2026-10-20')).toHaveAttribute('data-crunch', 'false');
    expect(cellEl('2026-10-23')).toHaveAttribute('data-crunch', 'false');
  });

  it('F4-AC-8[P1]: 크런치 칸 배경은 Red50이고 일반 칸은 아니다', () => {
    renderHarness(modelFor(BASE.settings, BASE.outflows));

    const crunch = cellEl('2026-10-24');
    expect(crunch).toHaveAttribute('data-crunch', 'true');
    const bg = crunch.style.getPropertyValue('background-color') || crunch.style.backgroundColor;
    expect(bg).toBe('var(--adaptiveRed50)');
    const plain = cellEl('2026-10-14');
    expect(plain).toHaveAttribute('data-crunch', 'false');
    expect(plain.style.backgroundColor).not.toBe('var(--adaptiveRed50)');
  });
});
