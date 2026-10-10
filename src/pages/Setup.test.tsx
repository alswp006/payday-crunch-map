import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockTds, mockAnalytics, mockRouter, mockNavigate, mockOpenToast } from '@/__tests__/__helpers__/mocks';
import { BASE } from '@/test/fixtures';
import { SETTINGS_KEY } from '@/lib/store/keys';
import { AppDataProvider } from '@/state/AppDataContext';
import type { SetupRouteState } from '@/types/nav';
import Setup from '@/pages/Setup';

mockTds();
mockAnalytics();
mockRouter();

function renderSetup(state: SetupRouteState | null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/setup', state }]}>
      <AppDataProvider>
        <Setup />
      </AppDataProvider>
    </MemoryRouter>,
  );
}

const salary = () => screen.getByLabelText(/월급 실수령액/) as HTMLInputElement;
const day = () => screen.getByLabelText(/월급일/) as HTMLInputElement;
const balance = () => screen.getByLabelText(/잔고/) as HTMLInputElement;

function type(el: HTMLInputElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

function stored() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T09:00:00+09:00'));
  mockNavigate.mockReset();
  mockOpenToast.mockReset();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe('Setup 화면 골격', () => {
  it('Layout: onboarding은 제목·빈 칸 세 개(라벨 항상 노출)·전체폭 CTA 하나로 구성된다', () => {
    renderSetup({ mode: 'onboarding' });

    expect(screen.getByRole('heading', { name: '월급과 잔고를 알려주세요' })).toBeInTheDocument();
    for (const input of [salary(), day(), balance()]) {
      expect(input.value).toBe('');
      expect(input.placeholder).not.toBe('');
    }
    // 빈 칸에서도 라벨이 보여야 칸을 구별한다(labelOption="sustain").
    expect(screen.getByText('월급 실수령액 (원)')).toBeVisible();
    expect(screen.getByText('월급일 (일)')).toBeVisible();
    expect(screen.getByText('지금 통장 잔고 (원)')).toBeVisible();

    // 하단 CTA는 SubmitFooter(FixedBottomCTA) 하나뿐이다 — 버튼 안에 버튼이 없다.
    const cta = screen.getByRole('button', { name: '다음' });
    expect(cta.querySelector('button')).toBeNull();
    expect(screen.getByTestId('submit-footer-hint')).toHaveTextContent('빈 칸을 모두 채우면 다음으로 갈 수 있어요');
    expect(screen.queryByText(/잔고 기준일/)).toBeNull();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('Layout: edit은 제목·저장된 값·잔고 기준일을 보이고 CTA는 저장이다', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    renderSetup({ mode: 'edit' });

    expect(screen.getByRole('heading', { name: '월급·잔고' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    expect(screen.queryByTestId('submit-footer-hint')).toBeNull();
    expect(screen.getByText('잔고 기준일: 10월 11일')).toBeInTheDocument();
  });

  it('진입 state가 없어도 저장된 설정이 있으면 edit 화면으로 열린다', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    renderSetup(null);

    expect(salary().value).toBe('2,500,000');
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });
});

describe('Setup 입력 동작', () => {
  it('주말 규칙 칩을 고르면 선택이 바뀌고 저장값에 담긴다', () => {
    renderSetup({ mode: 'onboarding' });
    fireEvent.click(screen.getByRole('button', { name: '다음 평일' }));

    expect(screen.getByRole('button', { name: '다음 평일', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '그대로', pressed: false })).toBeInTheDocument();

    type(salary(), '2500000');
    type(day(), '25');
    type(balance(), '800000');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(stored().salaryWeekendRule).toBe('nextBusinessDay');
  });

  it('잔고 칸에서 Enter를 누르면 모든 칸이 찼을 때 저장하고 이동한다', () => {
    renderSetup({ mode: 'onboarding' });
    type(salary(), '2500000');
    type(day(), '25');
    type(balance(), '800000');

    fireEvent.keyDown(balance(), { key: 'Enter' });

    expect(stored()).toEqual(BASE.settings);
    expect(mockNavigate).toHaveBeenCalledWith('/items', { state: { from: 'onboarding' } });
  });

  it('범위 오류로 저장이 막히면 첫 오류 칸으로 포커스가 옮겨진다', () => {
    renderSetup({ mode: 'onboarding' });
    type(salary(), '2500000');
    type(day(), '40');
    type(balance(), '800000');

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(document.activeElement).toBe(day());
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
  });

  it('숫자가 아닌 글자는 입력되지 않는다', () => {
    renderSetup({ mode: 'onboarding' });
    type(salary(), '25abc00');

    expect(salary().value).toBe('2,500');
  });
});
