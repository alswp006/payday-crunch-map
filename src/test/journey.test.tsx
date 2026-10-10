// 핵심 여정 통합 테스트 — 빈 저장소에서 /setup → /items → 하단 '달력' 탭으로 홈에 도착한다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { mockTds, mockAnalytics, mockOpenToast } from '@/__tests__/__helpers__/mocks';
import { BASE } from '@/test/fixtures';
import { OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';

mockTds();
mockAnalytics();

// mocks.ts가 호이스팅해 등록한 react-router-dom 목을 풀고 실제 라우터로 전체 App을 돌린다.
vi.doUnmock('react-router-dom');

const { MemoryRouter } = await import('react-router-dom');
const { default: App } = await import('@/App');

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  mockOpenToast.mockClear();
  vi.stubEnv('VITE_TOSS_AD_SLOT_ID', '');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe('핵심 여정 — onboarding → items → home', () => {
  it('F4-AC-1: setup·items를 거쳐 달력 탭으로 가면 10월 24일 월세 -25.2만과 최저 -252,000원이 보인다', () => {
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <App />
      </MemoryRouter>,
    );

    // 1) /setup
    expect(screen.getByRole('heading', { name: '월급과 잔고를 알려주세요' })).toBeInTheDocument();
    type(/월급 실수령액/, '2500000');
    type(/월급일/, '25');
    type(/잔고/, '800000');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual(BASE.settings);

    // 2) /items — BASE 4개를 등록 순서대로 추가
    expect(screen.getByRole('button', { name: '달력 보기' })).toBeInTheDocument();
    for (const item of BASE.outflows) {
      fireEvent.click(screen.getByRole('button', { name: '출금 추가' }));
      type(/이름/, item.name);
      type(/금액/, String(item.amount));
      type(/출금일/, String(item.day));
      fireEvent.click(screen.getByRole('button', { name: '추가하기' }));
    }
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? '{}').items as {
      name: string;
      amount: number;
      day: number;
    }[];
    expect(stored.map((o) => [o.name, o.amount, o.day])).toEqual(
      BASE.outflows.map((o) => [o.name, o.amount, o.day]),
    );

    // 3) 하단 '달력' 탭 — 탭바가 없는 온보딩 화면이면 '달력 보기' CTA로 간다
    const tab = screen.queryByRole('tab', { name: '달력' });
    fireEvent.click(tab ?? screen.getByRole('button', { name: '달력 보기' }));

    // 홈
    const cell = screen.getByTestId('day-cell-2026-10-24');
    expect(within(cell).getByText('월세')).toBeInTheDocument();
    expect(within(cell).getByText('-25.2만')).toBeInTheDocument();
    expect(within(screen.getByTestId('lowest-day-card')).getByText('-252,000원')).toBeInTheDocument();

    // 항목마다 '추가했어요' 성공 Toast 하나씩 — 실패 Toast는 없다
    expect(mockOpenToast.mock.calls.map((c) => c[0])).toEqual(Array(4).fill('추가했어요'));
    expect(consoleError).not.toHaveBeenCalled();
  });
});
