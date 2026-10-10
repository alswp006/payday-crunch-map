import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('OutflowSheet', () => {
  it('제목과 버튼이 모드에 따라 바뀐다', () => {
    const { rerender } = render(<OutflowSheet open mode="add" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('출금 추가')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument();

    rerender(<OutflowSheet open mode="edit" onSubmit={vi.fn()} onClose={vi.fn()} />);
    // 열린 채 mode만 바뀌어도 입력은 유지되지만 제목·버튼 문구는 따라간다.
    expect(screen.getByText('출금 수정')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it("주말 칩은 기본이 '그대로'이고 탭하면 선택이 바뀌어 onSubmit에 담긴다", () => {
    const onSubmit = vi.fn();
    render(<OutflowSheet open mode="add" onSubmit={onSubmit} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '그대로', pressed: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 평일' }));
    expect(screen.getByRole('button', { name: '다음 평일', pressed: true })).toBeInTheDocument();

    type(screen.getByLabelText(/이름/), '카드값');
    type(screen.getByLabelText(/금액/), '420000');
    type(screen.getByLabelText(/출금일/), '14');
    fireEvent.click(screen.getByRole('button', { name: '추가하기' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: '카드값', amount: 420000, day: 14, weekendRule: 'nextBusinessDay' });
  });

  it('닫았다가 다시 열면 입력이 초기값으로 돌아간다', () => {
    const { rerender } = render(<OutflowSheet open mode="add" onSubmit={vi.fn()} onClose={vi.fn()} />);
    type(screen.getByLabelText(/이름/), '월세');

    rerender(<OutflowSheet open={false} mode="add" onSubmit={vi.fn()} onClose={vi.fn()} />);
    rerender(<OutflowSheet open mode="add" initialName="카드값" onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect((screen.getByLabelText(/이름/) as HTMLInputElement).value).toBe('카드값');
  });

  it('출금일에서 Enter를 누르면 검증을 통과한 값으로 제출한다', () => {
    const onSubmit = vi.fn();
    render(<OutflowSheet open mode="add" onSubmit={onSubmit} onClose={vi.fn()} />);

    type(screen.getByLabelText(/이름/), '월세');
    type(screen.getByLabelText(/금액/), '550000');
    const day = screen.getByLabelText(/출금일/);
    type(day, '24');
    fireEvent.keyDown(day, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith({ name: '월세', amount: 550000, day: 24, weekendRule: 'none' });
  });
});
