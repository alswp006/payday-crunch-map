import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { buildHomeModel } from '@/lib/balance/homeModel';
import type { HomeCell, HomeModel } from '@/lib/balance/homeModel';
import type { Outflow } from '@/lib/types';
import { CalendarGrid } from './CalendarGrid';
import { DayDetailSheet } from './DayDetailSheet';

mockTds();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
});

const MGMT: Outflow = { id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' };
const INSURANCE: Outflow = { id: 'o-ins', name: '보험료', amount: 30000, day: 24, weekendRule: 'none' };

function modelFor(outflows: Outflow[]): HomeModel {
  return buildHomeModel({ settings: BASE.settings, outflows, today: BASE_TODAY, month: '2026-10' });
}

function Harness({ model, onDayClick }: { model: HomeModel; onDayClick?: (cell: HomeCell) => void }) {
  const [cell, setCell] = useState<HomeCell | null>(null);
  return (
    <>
      <CalendarGrid
        model={model}
        onDayClick={(c) => {
          onDayClick?.(c);
          setCell(c);
        }}
      />
      <DayDetailSheet open={cell !== null} cell={cell} onClose={() => setCell(null)} />
    </>
  );
}

function cellEl(date: string): HTMLElement {
  return screen.getByTestId(`day-cell-${date}`);
}

function colorOf(el: HTMLElement): string {
  return el.getAttribute('data-color') || el.style.color;
}

describe('CalendarGrid', () => {
  it('10-24 칸에 월세와 -25.2만이 보이고 금액은 Red500이다', () => {
    render(<Harness model={modelFor(BASE.outflows)} />);
    const cell = cellEl('2026-10-24');

    expect(within(cell).getByText('월세')).toBeInTheDocument();
    expect(colorOf(within(cell).getByText('-25.2만'))).toBe('var(--adaptiveRed500)');
  });

  it('한 칸에 이름은 1개만 보이고 나머지는 +N이다', () => {
    render(<Harness model={modelFor([...BASE.outflows, INSURANCE])} />);
    const cell = cellEl('2026-10-24');

    expect(within(cell).queryByText('보험료')).toBeNull();
    expect(within(cell).getByText('+1')).toBeInTheDocument();
  });

  it('머리줄 7칸 + 앞쪽 빈칸 4개 + 날짜 칸 31개이고 Card 안에 있다', () => {
    render(<Harness model={modelFor(BASE.outflows)} />);
    const grid = screen.getByTestId('calendar-grid');

    let card: HTMLElement | null = grid.parentElement;
    while (card && card.style.borderRadius !== '16px') card = card.parentElement;
    expect(card).not.toBeNull();

    expect(Array.from(grid.children).slice(0, 7).map((c) => c.textContent)).toEqual(['일', '월', '화', '수', '목', '금', '토']);
    expect(screen.getAllByTestId(/^day-cell-/)).toHaveLength(31);
    expect(grid.children).toHaveLength(7 + 4 + 31);
  });

  it('지난 날은 Grey400이고 잔고가 없다', () => {
    render(<Harness model={modelFor([...BASE.outflows, MGMT])} />);

    expect(colorOf(within(cellEl('2026-10-05')).getByText('관리비'))).toBe('var(--adaptiveGrey400)');
    expect(cellEl('2026-10-05').textContent).not.toMatch(/만|,/);
    expect(within(cellEl('2026-10-11')).getByText('80만')).toBeInTheDocument();
  });

  it('잔고가 없는 칸은 탭해도 onDayClick이 불리지 않는다', () => {
    const onDayClick = vi.fn();
    render(<Harness model={modelFor([...BASE.outflows, MGMT])} onDayClick={onDayClick} />);

    fireEvent.click(cellEl('2026-10-05'));

    expect(onDayClick).not.toHaveBeenCalled();
  });

  it('크런치 칸은 Red50 배경과 data-crunch, 최저일 칸은 data-lowest가 붙는다', () => {
    render(<Harness model={modelFor(BASE.outflows)} />);

    expect(cellEl('2026-10-24')).toHaveAttribute('data-crunch', 'true');
    expect(cellEl('2026-10-24').style.backgroundColor).toBe('var(--adaptiveRed50)');
    expect(cellEl('2026-10-14')).toHaveAttribute('data-crunch', 'false');
    expect(cellEl('2026-10-14')).toHaveAttribute('data-lowest', 'false');
  });
});

describe('DayDetailSheet', () => {
  it('10-24를 탭하면 제목·월세 행·마감 잔고가 보이고 최저 줄은 없다', () => {
    render(<Harness model={modelFor(BASE.outflows)} />);

    fireEvent.click(cellEl('2026-10-24'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('10월 24일 (토)')).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/월세\s*-550,000원/);
    expect(within(dialog).getByText('하루 마감 잔고 -252,000원')).toBeInTheDocument();
    expect(within(dialog).queryByText(/출금 후 최저/)).toBeNull();
  });

  it('이벤트가 없는 날은 안내 문구를 보인다', () => {
    render(<Harness model={modelFor(BASE.outflows)} />);

    fireEvent.click(cellEl('2026-10-12'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('이날은 출금·입금이 없어요')).toBeInTheDocument();
    expect(within(dialog).getByText('하루 마감 잔고 800,000원')).toBeInTheDocument();
  });

  it('cell이 null이면 아무것도 그리지 않는다', () => {
    render(<DayDetailSheet open cell={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
