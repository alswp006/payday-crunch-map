import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { mockTds, mockAnalytics, mockLogImpression } from '@/__tests__/__helpers__/mocks';
import { BASE, BASE_TODAY } from '@/test/fixtures';
import { OUTFLOWS_KEY, SETTINGS_KEY } from '@/lib/store/keys';
import { AppDataProvider } from '@/state/AppDataContext';
import { SimSection } from '@/components/home/SimSection';

mockTds();
mockAnalytics();

const { loadFullScreenAd } = vi.hoisted(() => ({ loadFullScreenAd: vi.fn() }));
vi.mock('@apps-in-toss/web-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apps-in-toss/web-framework')>()),
  loadFullScreenAd,
  generateHapticFeedback: vi.fn(),
}));

function renderSection(outflows = BASE.outflows) {
  return render(
    <MemoryRouter>
      <AppDataProvider>
        <SimSection settings={BASE.settings} outflows={outflows} today={BASE_TODAY} />
      </AppDataProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
  loadFullScreenAd.mockReset();
  mockLogImpression.mockClear();
  // 슬롯이 비어 있으면 게이트가 바로 열린다 — 잠금 층 목록만 보고 싶은 테스트의 기본값.
  vi.stubEnv('VITE_TOSS_AD_SLOT_ID', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SimSection', () => {
  it('게이트가 열리면 제목·sim-row 4개·안내 문구가 locked-tier 안에 있고 teaser는 없다', () => {
    renderSection();

    const tier = screen.getByTestId('locked-tier');
    expect(within(tier).getByText('출금일을 옮기면')).toBeInTheDocument();
    expect(within(tier).getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(
      within(tier).getByText(
        '오늘부터 다음 달 말일까지의 예상 잔고 기준이에요. 실제로 바꿀 수 있는 날짜는 카드사·은행에 확인하세요',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('locked-teaser')).toBeNull();
  });

  it('잠긴 동안 게이트 안쪽에는 잠금 층만 있고 무료 층(free-tier)은 없다', () => {
    vi.stubEnv('VITE_TOSS_AD_SLOT_ID', 'slot-from-console');
    loadFullScreenAd.mockImplementation(() => {});
    renderSection();

    const section = screen.getByTestId('sim-section');
    expect(section.querySelectorAll('[data-testid="free-tier"]')).toHaveLength(0);
    expect(screen.queryByTestId('locked-tier')).toBeNull();
    expect(screen.getByTestId('locked-teaser')).toBeInTheDocument();
  });

  it('sim-row를 탭하면 해당 항목의 출금일 바꿔보기 시트가 열린다', () => {
    renderSection();

    expect(screen.queryByText('출금일 바꿔보기')).toBeNull();
    fireEvent.click(screen.getByTestId('sim-row-o-card'));

    expect(screen.getByText('출금일 바꿔보기')).toBeInTheDocument();
    expect(screen.getByText('카드값 · 지금 14일')).toBeInTheDocument();
  });

  it('출금 항목이 0개면 아무것도 마운트하지 않고 광고도 부르지 않는다', () => {
    vi.stubEnv('VITE_TOSS_AD_SLOT_ID', 'slot-from-console');
    renderSection([]);

    expect(screen.queryByTestId('sim-section')).toBeNull();
    expect(screen.queryByTestId('locked-teaser')).toBeNull();
    expect(screen.queryByTestId('locked-tier')).toBeNull();
    expect(loadFullScreenAd).not.toHaveBeenCalled();
    expect(mockLogImpression).not.toHaveBeenCalled();
  });
});
