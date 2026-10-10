import { useEffect, useMemo, useRef, useState } from 'react';
import { ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { ShiftSheet } from '@/components/home/ShiftSheet';
import { logImpression } from '@/lib/analytics';
import { bestShifts } from '@/lib/balance/simulate';
import { formatSignedWon } from '@/lib/format';
import type { LocalDate, Outflow, PaySettings, SimResult } from '@/lib/types';

export interface LockedTierProps {
  settings: PaySettings;
  outflows: Outflow[];
  today: LocalDate;
  /** 잠금 층이 마운트됐다 = 게이트가 열렸다. 부모가 teaser를 걷는 데 쓴다. */
  onUnlocked: () => void;
}

const TITLE = '출금일을 옮기면';
const FOOTNOTE = '오늘부터 다음 달 말일까지의 예상 잔고 기준이에요. 실제로 바꿀 수 있는 날짜는 카드사·은행에 확인하세요';

function rowTop(r: SimResult): string {
  if (r.toDay === r.fromDay) return `${r.name} ${r.fromDay}일 · 지금 날짜가 가장 유리해요`;
  return `${r.name} ${r.fromDay}일 → ${r.toDay}일`;
}

/** 첫 행에만 '최저 잔고'를 붙여 무엇의 증가분인지 알린다. */
function rowBottom(r: SimResult, first: boolean): string {
  if (r.toDay === r.fromDay || r.delta <= 0) return '변화 없음 (0원)';
  const amount = formatSignedWon(r.delta);
  return first ? `최저 잔고 ${amount}` : amount;
}

/**
 * 리워드 게이트 안쪽의 잠금 층. 항목마다 가장 유리한 출금일을 보여 주고,
 * 행을 탭하면 직접 날짜를 넣어 비교·저장하는 ShiftSheet를 연다.
 */
export function LockedTier({ settings, outflows, today, onUnlocked }: LockedTierProps) {
  const [sheet, setSheet] = useState<{ itemId: string; open: boolean } | null>(null);
  const results = useMemo(() => bestShifts(settings, outflows, today), [settings, outflows, today]);

  // 마운트 1회. StrictMode가 effect를 두 번 돌려도 노출은 한 번만 남긴다.
  const mounted = useRef(false);
  const unlockedRef = useRef(onUnlocked);
  unlockedRef.current = onUnlocked;
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    unlockedRef.current();
    logImpression('sim_locked_tier');
  }, []);

  return (
    <div data-testid="locked-tier">
      <Paragraph typography="t4">{TITLE}</Paragraph>
      <Spacing size={8} />
      {results.map((r, index) => (
        <ListRow
          key={r.itemId}
          data-testid={`sim-row-${r.itemId}`}
          withArrow
          onClick={() => setSheet({ itemId: r.itemId, open: true })}
          contents={<ListRow.Texts type="2RowTypeA" top={rowTop(r)} bottom={rowBottom(r, index === 0)} />}
        />
      ))}
      <Spacing size={8} />
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {FOOTNOTE}
      </Paragraph.Text>
      {sheet && (
        <ShiftSheet
          open={sheet.open}
          itemId={sheet.itemId}
          settings={settings}
          outflows={outflows}
          today={today}
          onClose={() => setSheet({ ...sheet, open: false })}
        />
      )}
    </div>
  );
}
