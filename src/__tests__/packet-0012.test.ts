/**
 * Packet 0012 테스트: OutflowSheet (src/components/items/OutflowSheet.tsx).
 *
 * 추가·수정 공용 BottomSheet. 검증을 통과하면 onSubmit({ name, amount, day, weekendRule })만 부른다.
 * 아직 구현 파일이 없으므로 이 테스트는 red가 정상이다.
 *
 * 기대하는 props: open · mode('add' | 'edit') · initial?({ name, amount, day, weekendRule? }) ·
 * initialName? · onSubmit · onDelete? · onClose
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { OutflowSheet } from '@/components/items/OutflowSheet';

mockTds();

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

type SheetProps = Record<string, unknown>;

function sheet(props: SheetProps) {
  return React.createElement(
    MemoryRouter,
    null,
    React.createElement(OutflowSheet as unknown as React.ComponentType<SheetProps>, {
      open: true,
      mode: 'add',
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      ...props,
    }),
  );
}

function fields() {
  return {
    name: screen.getByLabelText(/이름/) as HTMLInputElement,
    amount: screen.getByLabelText(/금액/) as HTMLInputElement,
    day: screen.getByLabelText(/출금일/) as HTMLInputElement,
  };
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('출금 항목 BottomSheet (추가·수정 공용 OutflowSheet)', () => {
  it("AC-1[P0]: 이름 input의 maxLength는 20이고 add 모드에는 '추가하기'만 있고 '삭제'는 없다", () => {
    render(sheet({}));
    const { name } = fields();

    expect(name.getAttribute('maxlength')).toBe('20');
    expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it.each([
    ['이름 공백만', '   ', '550000', '24', '항목 이름을 입력해주세요'],
    ['금액 0', '월세', '0', '24', '0원보다 큰 금액을 입력해주세요'],
    ['금액 100000001', '월세', '100000001', '24', '1억 원 이하로 입력해주세요'],
    ['날짜 32', '월세', '550000', '32', '1~31 사이 날짜를 입력해주세요'],
  ])('AC-1[P0]: %s으로 제출하면 문구를 보이고 onSubmit은 0회다', (_label, nameValue, amountValue, dayValue, message) => {
    const onSubmit = vi.fn();
    render(sheet({ onSubmit }));
    const { name, amount, day } = fields();

    type(name, nameValue);
    type(amount, amountValue);
    type(day, dayValue);
    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it('AC-1[P0]: 검증을 통과하면 이름을 trim하고 숫자로 바꿔 onSubmit을 1회 부른다', () => {
    const onSubmit = vi.fn();
    render(sheet({ onSubmit }));
    const { name, amount, day } = fields();

    type(name, '  월세 ');
    type(amount, '550,000');
    type(day, '24');
    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ name: '월세', amount: 550000, day: 24, weekendRule: 'none' });
  });

  it("AC-2[P1]: 이름 '월세'에 금액이나 날짜가 비면 '추가하기'가 disabled이고 금액을 비운 채 blur하면 문구가 보인다", () => {
    const onSubmit = vi.fn();
    render(sheet({ onSubmit }));
    const { name, amount, day } = fields();
    const button = screen.getByRole('button', { name: '추가하기' });

    type(name, '월세');
    type(day, '24');
    expect(button).toBeDisabled();

    fireEvent.focus(amount);
    fireEvent.blur(amount);
    expect(screen.getByText('금액을 입력해주세요')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(0);

    type(amount, '550000');
    expect(button).toBeEnabled();
  });

  it("AC-2[P1]: 이름 '   '은 빈 값이 아니므로 금액·날짜가 있으면 버튼이 활성이다", () => {
    render(sheet({}));
    const { name, amount, day } = fields();

    type(name, '   ');
    type(amount, '550000');
    type(day, '24');

    expect(screen.getByRole('button', { name: '추가하기' })).toBeEnabled();
    expect(screen.queryByText('항목 이름을 입력해주세요')).toBeNull();
  });

  it("AC-3[P1]: initialName '카드값'으로 열면 이름 칸은 '카드값'이고 금액·날짜는 비어 있다", () => {
    render(sheet({ initialName: '카드값' }));
    const { name, amount, day } = fields();

    expect(name.value).toBe('카드값');
    expect(amount.value).toBe('');
    expect(day.value).toBe('');
  });

  it("AC-4[P1]: edit 모드는 initial로 세 필드를 채우고 '저장하기'·'삭제'가 있으며 '삭제'는 onDelete를 1회 부른다", () => {
    const onDelete = vi.fn();
    const onSubmit = vi.fn();
    render(
      sheet({
        mode: 'edit',
        initial: { name: '카드값', amount: 420000, day: 26, weekendRule: 'none' },
        onDelete,
        onSubmit,
      }),
    );
    const { name, amount, day } = fields();

    expect(name.value).toBe('카드값');
    expect(amount.value).toBe('420,000');
    expect(day.value).toBe('26');
    expect(screen.getByRole('button', { name: '저장하기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '추가하기' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it('AC-5[P2]: 부모가 open을 유지한 채 다시 렌더해도 입력값이 유지된다', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(sheet({ onSubmit: first }));
    const { name, amount, day } = fields();

    type(name, '월세');
    type(amount, '550000');
    type(day, '24');

    rerender(sheet({ onSubmit: second }));

    const after = fields();
    expect(after.name.value).toBe('월세');
    expect(after.amount.value).toBe('550,000');
    expect(after.day.value).toBe('24');

    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));
    expect(second).toHaveBeenCalledWith({ name: '월세', amount: 550000, day: 24, weekendRule: 'none' });
    expect(first).toHaveBeenCalledTimes(0);
  });
});
