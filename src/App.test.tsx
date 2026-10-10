import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { mockTds, mockAnalytics, mockOpenToast } from '@/__tests__/__helpers__/mocks';
import { BASE } from '@/test/fixtures';
import { OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';

mockTds();
mockAnalytics();

// mocks.ts는 import되는 순간 react-router-dom 목(useLocation=mockLocation)을 호이스팅해 등록한다.
// 이 테스트는 실제 pathname·replace를 보므로 목을 풀고 라우터를 쓰는 모듈은 그 뒤에 동적으로 불러온다.
vi.doUnmock('react-router-dom');

const { probe } = vi.hoisted(() => ({ probe: vi.fn<() => boolean>() }));
vi.mock('@/lib/store/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/store/storage')>();
  return { ...actual, probeStorage: () => probe() };
});
vi.mock('@/components/AdSlot', () => ({ AdSlot: () => <div data-testid="ad-slot" /> }));
vi.mock('@/components/TossRewardAd', () => {
  const Gate = ({ children }: { children?: React.ReactNode }) => <div data-testid="reward-ad">{children}</div>;
  return { TossRewardAd: Gate, default: Gate };
});

const { MemoryRouter, useLocation, useNavigate, useNavigationType } = await import('react-router-dom');
const { default: App } = await import('@/App');

const seen = { pathname: '', navType: '' };

function LocationProbe() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  seen.pathname = location.pathname;
  seen.navType = navType;
  return (
    <button data-testid="probe-back" onClick={() => navigate(-1)}>
      probe-back
    </button>
  );
}

type Entry = string | { pathname: string; state?: unknown };

function renderAt(entry: Entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function seed() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
}

/** 홈의 TDS Tab(이번 달/다음 달)도 role="tablist"라 이름으로 FloatingTabBar만 센다. */
function tabBars() {
  return screen.queryAllByRole('tablist', { name: '메인 네비게이션' });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  probe.mockReset();
  probe.mockReturnValue(true);
  mockOpenToast.mockClear();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('App — 라우팅 + StorageGuard', () => {
  it.each(['/', '/setup', '/items'])('AC-1: 저장소를 못 쓰면 %s에서도 안내 화면만 보인다', (path) => {
    probe.mockReturnValue(false);
    seed();
    renderAt(path);

    const guard = screen.getByTestId('storage-unavailable');
    expect(within(guard).getByText('텅장달력')).toBeInTheDocument();
    expect(guard.querySelectorAll('[data-content-icon]')).toHaveLength(1);
    expect(within(guard).getByText('저장 공간을 쓸 수 없어 달력을 만들 수 없어요')).toBeInTheDocument();
    expect(within(guard).getByText('토스 앱을 완전히 닫았다가 다시 열어주세요')).toBeInTheDocument();
    expect(within(guard).getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(tabBars()).toHaveLength(0);
    expect(screen.queryAllByTestId('ad-slot')).toHaveLength(0);
    expect(screen.queryAllByTestId('reward-ad')).toHaveLength(0);
    expect(seen.pathname).toBe(path);
  });

  it('AC-1: probeStorage는 첫 렌더에서 1회만 부른다', () => {
    seed();
    renderAt('/');
    expect(probe).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
  });

  it('AC-2: 다시 시도가 실패하면 Toast를 띄우고 그대로 머문다', () => {
    probe.mockReturnValue(false);
    seed();
    renderAt('/');

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith('아직 저장 공간을 쓸 수 없어요');
    expect(screen.getByTestId('storage-unavailable')).toBeInTheDocument();
    expect(seen.pathname).toBe('/');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('AC-2: 다시 시도가 성공하면 원래 경로(홈)를 그린다', () => {
    probe.mockReturnValue(false);
    seed();
    renderAt('/');

    probe.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
    expect(screen.getByTestId('lowest-day-card')).toBeInTheDocument();
    expect(seen.pathname).toBe('/');
    expect(mockOpenToast).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(['/result', '/foo/bar'])('AC-3: %s는 replace로 홈이 된다', (path) => {
    seed();
    renderAt(path);

    expect(seen.pathname).toBe('/');
    expect(seen.navType).toBe('REPLACE');
    expect(screen.getByTestId('lowest-day-card')).toBeInTheDocument();
    expect(mockOpenToast).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('probe-back'));
    expect(seen.pathname).toBe('/');
  });

  it("AC-4: 탭바는 '/'·'/items'에 1개, '/setup'에 0개다", () => {
    seed();
    const home = renderAt('/');
    expect(tabBars()).toHaveLength(1);
    expect(within(tabBars()[0]).getByRole('tab', { name: '달력' })).toHaveAttribute('aria-selected', 'true');
    expect(within(tabBars()[0]).getByRole('tab', { name: '출금 항목' })).toBeInTheDocument();
    home.unmount();

    const items = renderAt('/items');
    expect(tabBars()).toHaveLength(1);
    expect(within(tabBars()[0]).getByRole('tab', { name: '출금 항목' })).toHaveAttribute('aria-selected', 'true');
    items.unmount();

    renderAt('/setup');
    expect(seen.pathname).toBe('/setup');
    expect(tabBars()).toHaveLength(0);
  });

  it('온보딩 중인 /items는 하단 CTA와 겹치지 않게 탭바를 그리지 않는다', () => {
    seed();
    renderAt({ pathname: '/items', state: { from: 'onboarding' } });
    expect(screen.getByRole('button', { name: '달력 보기' })).toBeInTheDocument();
    expect(tabBars()).toHaveLength(0);
  });

  it('AC-4: src/main.tsx의 diff는 0줄이다', () => {
    const diff = execSync('git diff HEAD --numstat -- src/main.tsx', { encoding: 'utf8' });
    expect(diff.trim()).toBe('');
  });
});
