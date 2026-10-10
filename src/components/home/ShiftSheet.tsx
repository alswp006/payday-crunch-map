import { useMemo, useState } from 'react';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { BottomSheet, Paragraph, Spacing, useToast } from '@toss/tds-mobile';
import { NumericField } from '@/components/form/NumericField';
import { logClick } from '@/lib/analytics';
import { bestShifts, simulateShift } from '@/lib/balance/simulate';
import { formatSignedWon, formatWon } from '@/lib/format';
import { requestReviewOnce } from '@/lib/review';
import type { LocalDate, Outflow, PaySettings } from '@/lib/types';
import { useAppData } from '@/state/AppDataContext';

export interface ShiftSheetProps {
  open: boolean;
  /** 날짜를 바꿔 볼 출금 항목 id. outflows에 없으면 아무것도 그리지 않는다. */
  itemId: string;
  settings: PaySettings;
  outflows: Outflow[];
  today: LocalDate;
  onClose: () => void;
}

const MONTH_END_NOTE = '29~31일은 그 날짜가 없는 달에 말일로 계산해요';

function validateDay(day: string): string | undefined {
  if (day === '') return '바꿀 날짜를 입력해주세요';
  const value = Number(day);
  if (!Number.isInteger(value) || value < 1 || value > 31) return '1~31 사이 날짜를 입력해주세요';
  return undefined;
}

function successHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    // WebView 밖에서는 브릿지가 없다 — 조용히 넘어간다.
  }
}

/** 리뷰 요청은 부가 동작이다 — 실패해도 저장 흐름과 토스트를 건드리지 않는다. */
function askForReview() {
  try {
    Promise.resolve(requestReviewOnce()).catch(() => {});
  } catch {
    // 브릿지 없음 — 무음.
  }
}

function ShiftSheetBody({ open, itemId, settings, outflows, today, onClose }: ShiftSheetProps) {
  const { openToast } = useToast();
  const { setOutflowDay } = useAppData();

  const item = outflows.find((o) => o.id === itemId);
  // 여는 순간의 추천 날짜로 시작하고, 열려 있는 동안은 입력값을 유지한다.
  const [day, setDay] = useState(() => {
    const best = bestShifts(settings, outflows, today).find((r) => r.itemId === itemId);
    return best ? String(best.toDay) : '';
  });

  const error = validateDay(day);
  const dayNumber = Number(day);
  const sim = useMemo(
    () => (error ? null : simulateShift(settings, outflows, itemId, dayNumber, today)),
    [error, settings, outflows, itemId, dayNumber, today],
  );

  if (!item) return null;

  const showMonthEndNote = !error && dayNumber >= 29;
  // 이번 달에 쓰는 날짜는 시뮬레이션 결과가 안다(dayChange 반영).
  const currentDay = sim?.fromDay ?? item.day;

  function handleSave() {
    if (error || !item) return;
    logClick('sim_save_day');
    const result = setOutflowDay(itemId, dayNumber, today);
    if (!result.ok) {
      openToast('저장하지 못했어요. 다시 시도해주세요');
      return;
    }
    successHaptic();
    openToast(`${item.name} 출금일을 ${dayNumber}일로 바꿨어요`);
    askForReview();
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>출금일 바꿔보기</BottomSheet.Header>}
      cta={
        <BottomSheet.CTA disabled={Boolean(error)} onClick={handleSave}>
          이 날짜로 저장
        </BottomSheet.CTA>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 24px', overflowWrap: 'break-word' }}>
        <Paragraph typography="t6">{`${item.name} · 지금 ${currentDay}일`}</Paragraph>
        <Spacing size={12} />
        <NumericField
          label="바꿀 날짜 (일)"
          placeholder="예: 26"
          value={day}
          error={error}
          enterKeyHint="done"
          onChange={setDay}
          onEnter={handleSave}
        />
        <Spacing size={12} />
        {sim && (
          <Paragraph typography="t5">
            {`지금 최저 ${formatWon(sim.baseMin)}원 → 바꾸면 ${formatWon(sim.newMin)}원 (${formatSignedWon(sim.delta)})`}
          </Paragraph>
        )}
        {showMonthEndNote && (
          <Paragraph typography="t7" color="var(--adaptiveGrey600)">
            {MONTH_END_NOTE}
          </Paragraph>
        )}
        <Spacing size={24} />
      </div>
    </BottomSheet>
  );
}

/**
 * 잠금 층의 sim-row를 탭하면 여는 '출금일 바꿔보기' 시트.
 * 닫혔다가 다시 열릴 때마다 추천 날짜로 새로 시작한다.
 */
export function ShiftSheet(props: ShiftSheetProps) {
  const [wasOpen, setWasOpen] = useState(props.open);
  const [session, setSession] = useState(0);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((s) => s + 1);
  }
  return <ShiftSheetBody key={session} {...props} />;
}
