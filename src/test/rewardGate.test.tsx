// 리워드 게이트 통합 테스트 — 광고 슬롯(VITE_TOSS_AD_SLOT_ID)이 비어 있으면
// 무료 층은 그대로 보이고, 잠금 층은 광고 없이 자동으로 열린다(실패 Toast 없음).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { mockTds, mockAnalytics, mockOpenToast, mockLogImpression } from '@/__tests__/__helpers__/mocks';
import { BASE } from '@/test/fixtures';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';

mockTds();
mockAnalytics();

vi.doUnmock('react-router-dom');

const { MemoryRouter } = await import('react-router-dom');
const { default: App } = await import('@/App');

function seedBase() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
  localStorage.setItem(META_KEY, JSON.stringify({ version: 1, lastSeenMonth: '2026-10' }));
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  mockOpenToast.mockClear();
  mockLogImpression.mockClear();
  vi.stubEnv('VITE_TOSS_AD_SLOT_ID', '');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  seedBase();
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe('리워드 게이트 — 광고 슬롯 미설정', () => {
  it('F6-AC-1: 무료 층에 최저일 카드·달력·일정 목록이 보인다', () => {
    renderHome();

    const free = screen.getByTestId('free-tier');
    const lowest = within(free).getByTestId('lowest-day-card');
    expect(within(lowest).getByText(/10월 24일 \(토\)/)).toBeInTheDocument();
    expect(within(lowest).getByText('-252,000원')).toBeInTheDocument();
    expect(within(free).getAllByTestId('calendar-grid')).toHaveLength(1);
    expect(within(free).getAllByTestId('schedule-list')).toHaveLength(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('F6-AC-13: 잠금 층이 자동으로 열려 sim-row 4개가 보이고 티저는 없다', () => {
    renderHome();

    const locked = screen.getByTestId('locked-tier');
    expect(within(locked).getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(screen.queryByTestId('locked-teaser')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('F6-AC-13: 실패 Toast는 0개이고 sim_locked_tier 노출 로그는 1회다', () => {
    renderHome();

    expect(screen.getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(mockOpenToast).not.toHaveBeenCalled();
    const lockedLogs = mockLogImpression.mock.calls.filter((c) => c[0] === 'sim_locked_tier');
    expect(lockedLogs).toEqual([['sim_locked_tier']]);
  });
});
