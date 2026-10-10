import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { ScheduleList } from '@/components/home/ScheduleList';

mockTds();

describe('ScheduleList', () => {
  it('행이 없으면 목록만 비어 있다', () => {
    render(<ScheduleList rows={[]} />);
    expect(screen.getByTestId('schedule-list')).toBeEmptyDOMElement();
  });

  it('label과 sub를 그대로 그린다', () => {
    render(
      <ScheduleList
        rows={[{ key: 'k', date: '2026-10-14', kind: 'outflow', label: '10월 14일 (수) 카드값', sub: '-420,000원 · 잔고 380,000원' }]}
      />,
    );
    expect(screen.getByText('10월 14일 (수) 카드값')).toBeInTheDocument();
    expect(screen.getByText('-420,000원 · 잔고 380,000원')).toBeInTheDocument();
  });
});
