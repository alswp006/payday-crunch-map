// 월급·잔고 설정(/setup) — 첫 실행(onboarding)과 수정(edit)이 같은 화면이다.
// 입력값은 이 화면의 state에만 있고, 저장이 ok일 때만 localStorage에 쓴다.
import { useContext, useState } from 'react';
import { UNSAFE_LocationContext, useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { Chip, ChipItem, Paragraph, Spacing, Top, useToast } from '@toss/tds-mobile';
import { SubmitFooter } from '@/components/BottomCTA';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { NumericField } from '@/components/form/NumericField';
import { fireAndForget, logClick } from '@/lib/analytics';
import { parseLocalDate } from '@/lib/date/localDate';
import type { WeekendRule } from '@/lib/types';
import { useAppData } from '@/state/AppDataContext';
import type { ItemsRouteState, SetupRouteState } from '@/types/nav';
import { useSetupForm } from './setup/useSetupForm';
import type { SetupMode } from './setup/useSetupForm';

const WEEKEND_OPTIONS: ReadonlyArray<{ rule: WeekendRule; label: string }> = [
  { rule: 'none', label: '그대로' },
  { rule: 'prevBusinessDay', label: '직전 평일' },
  { rule: 'nextBusinessDay', label: '다음 평일' },
];

function haptic(type: 'success' | 'tickWeak') {
  fireAndForget(() => generateHapticFeedback({ type }));
}

/** '2026-10-11' → '잔고 기준일: 10월 11일' */
function balanceAsOfText(date: string): string | null {
  const parsed = parseLocalDate(date);
  return parsed ? `잔고 기준일: ${parsed.month}월 ${parsed.day}일` : null;
}

/**
 * 이 화면으로 들어올 때 넘어온 navigate state. state가 없거나 모양이 다르면 null이다.
 * useLocation 대신 LocationContext를 직접 읽는다 — 공용 테스트 헬퍼(mockRouter)가 useLocation을
 * state가 null인 고정 스텁으로 바꿔 두어, 훅으로는 focus 같은 진입 state를 검증할 수 없다.
 */
function useSetupRouteState(): SetupRouteState | null {
  const state: unknown = useContext(UNSAFE_LocationContext)?.location.state;
  if (typeof state !== 'object' || state === null) return null;
  const { mode, focus } = state as Partial<SetupRouteState>;
  if (mode !== 'onboarding' && mode !== 'edit') return null;
  return focus === 'balance' ? { mode, focus } : { mode };
}

export default function Setup() {
  const navigate = useNavigate();
  const { openToast } = useToast();
  const { settings } = useAppData();

  const routeState = useSetupRouteState();
  // 저장 직후 settings가 생겨도 화면 모드가 바뀌지 않게 첫 렌더에서 한 번만 정한다.
  const [mode] = useState<SetupMode>(() => routeState?.mode ?? (settings ? 'edit' : 'onboarding'));
  const editing = mode === 'edit';

  const form = useSetupForm({ mode, focusBalance: editing && routeState?.focus === 'balance' });

  function handleSubmit() {
    const outcome = form.submit();
    if (outcome === 'failed') {
      openToast('저장하지 못했어요. 다시 시도해주세요');
      return;
    }
    if (outcome !== 'saved') return;

    logClick('setup_save');
    if (editing) {
      openToast('저장했어요');
      navigate('/', { replace: true });
      return;
    }
    const next: ItemsRouteState = { from: 'onboarding' };
    navigate('/items', { state: next });
  }

  // 버튼 클릭은 SubmitFooter가 성공 햅틱을 낸다 — Enter 제출만 여기서 따로 낸다.
  function handleEnter() {
    if (form.canSubmit) haptic('success');
    handleSubmit();
  }

  function handleWeekendRule(rule: WeekendRule) {
    haptic('tickWeak');
    form.setWeekendRule(rule);
  }

  const asOfText = editing && form.balanceAsOf ? balanceAsOfText(form.balanceAsOf) : null;
  const label = editing ? '저장' : '다음';

  return (
    <ScreenScaffold
      flushX
      top={
        <Top
          title={<Top.TitleParagraph>{editing ? '월급·잔고' : '월급과 잔고를 알려주세요'}</Top.TitleParagraph>}
        />
      }
      bottom={
        <SubmitFooter
          label={label}
          onClick={handleSubmit}
          disabled={!form.canSubmit}
          hint={form.canSubmit ? undefined : `빈 칸을 모두 채우면 ${editing ? '저장할' : '다음으로 갈'} 수 있어요`}
        />
      }
    >
      <Spacing size={16} />
      <div ref={form.bindField('salary')}>
        <NumericField
          label="월급 실수령액 (원)"
          placeholder="예: 2,500,000"
          value={form.values.salary}
          error={form.errors.salary}
          enterKeyHint="next"
          onChange={form.setSalary}
          onBlur={() => form.touch('salary')}
        />
      </div>
      <Spacing size={12} />
      <div ref={form.bindField('day')}>
        <NumericField
          label="월급일 (일)"
          placeholder="예: 25"
          value={form.values.day}
          error={form.errors.day}
          enterKeyHint="next"
          onChange={form.setDay}
          onBlur={() => form.touch('day')}
        />
      </div>
      <Spacing size={12} />
      {/* TextField(box)의 자체 여백(20px)과 라벨·칩의 시작선을 맞춘다. */}
      <div style={{ paddingInline: 20 }}>
        <div style={{ paddingInline: 5 }}>
          <Paragraph.Text typography="t6">주말이면</Paragraph.Text>
        </div>
        <Spacing size={8} />
        <Chip kind="select" wrap margin="none">
          {WEEKEND_OPTIONS.map((option) => (
            <ChipItem
              key={option.rule}
              selected={form.weekendRule === option.rule}
              onClick={() => handleWeekendRule(option.rule)}
            >
              {option.label}
            </ChipItem>
          ))}
        </Chip>
      </div>
      <Spacing size={12} />
      <div ref={form.bindField('balance')}>
        <NumericField
          label="지금 통장 잔고 (원)"
          placeholder="예: 800,000"
          value={form.values.balance}
          error={form.errors.balance}
          enterKeyHint="done"
          onChange={form.setBalance}
          onBlur={() => form.touch('balance')}
          onEnter={handleEnter}
        />
      </div>
      {asOfText ? (
        <>
          <Spacing size={8} />
          <div style={{ paddingInline: 20 }}>
            <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
              {asOfText}
            </Paragraph.Text>
          </div>
        </>
      ) : null}
      {/* 하단 고정 버튼 아래로도 스크롤돼 마지막 칸이 가려지지 않게 한다. */}
      <Spacing size={120} />
    </ScreenScaffold>
  );
}
