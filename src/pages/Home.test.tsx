import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { mockTds, mockAnalytics, mockNavigate, mockOpenToast } from '@/__tests__/__helpers__/mocks';
import { BASE } from '@/test/fixtures';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';
import { AppDataProvider } from '@/state/AppDataContext';
import Home from '@/pages/Home';

mockTds();
mockAnalytics();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppDataProvider>
        <Home />
      </AppDataProvider>
    </MemoryRouter>,
  );
}

function seed(outflows: unknown[] = BASE.outflows) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: outflows }));
  localStorage.setItem(META_KEY, JSON.stringify({ version: 1, lastSeenMonth: '2026-10' }));
}

beforeEach(() => {
  // 공용 목의 Top이 h1 안에 TitleParagraph(h1)를 그려 validateDOMNesting 경고가 난다 — 목의 모양 문제라 삼킨다.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  mockNavigate.mockClear();
  mockOpenToast.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Home', () => {
  it('Layout: 앱 제목·월 Tab·무료 층 구성 요소가 한 화면에 모인다', () => {
    seed();
    renderHome();

    expect(screen.getByText('텅장달력')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '이번 달 (10월)' })).toHaveAttribute('aria-selected', 'true');
    const freeTier = screen.getByTestId('free-tier');
    expect(within(freeTier).getAllByTestId('lowest-day-card')).toHaveLength(1);
    expect(within(freeTier).getAllByTestId('calendar-grid')).toHaveLength(1);
    expect(within(freeTier).getAllByTestId('schedule-list')).toHaveLength(1);
  });

  it('Top 우측 \'월급·잔고\'는 설정 수정 화면으로 이동한다', () => {
    seed();
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: '월급·잔고' }));
    expect(mockNavigate).toHaveBeenCalledWith('/setup', { state: { mode: 'edit' } });
  });

  it('광고 그룹 ID가 없으면 AdSlot을 그리지 않고 나머지는 그대로 렌더된다', () => {
    vi.stubEnv('VITE_TOSS_AD_GROUP_ID', '');
    seed();
    renderHome();

    expect(document.querySelector('[data-ad-group-id]')).toBeNull();
    expect(screen.getByTestId('lowest-day-card')).toBeInTheDocument();
    expect(screen.getByTestId('sim-section')).toBeInTheDocument();
  });

  it('너무 오래된 기준일이면 오래됨 안내만 보이고 기준일 안내 행은 겹쳐 보이지 않는다', () => {
    vi.setSystemTime(new Date('2026-12-13T09:00:00+09:00'));
    seed();
    renderHome();

    expect(screen.getByText('잔고 기준일이 너무 오래됐어요 (10월 11일)')).toBeInTheDocument();
    expect(screen.queryByTestId('stale-balance-row')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '지금 잔고 입력' }));
    expect(mockNavigate).toHaveBeenCalledWith('/setup', { state: { mode: 'edit', focus: 'balance' } });
  });
});
