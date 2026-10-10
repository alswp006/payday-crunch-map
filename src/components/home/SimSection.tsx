import { useCallback, useState } from 'react';
import { Paragraph, Spacing } from '@toss/tds-mobile';
import { LockedTier } from '@/components/home/LockedTier';
import { TossRewardAd } from '@/components/TossRewardAd';
import type { LocalDate, Outflow, PaySettings } from '@/lib/types';

export interface SimSectionProps {
  settings: PaySettings;
  outflows: Outflow[];
  today: LocalDate;
}

/**
 * 출금일 시뮬레이션 영역. 무료 층은 이 컴포넌트 바깥에 있고, 게이트 안에는 잠금 층만 둔다.
 * 해제 상태는 세션 상태다 — 저장하지 않는다.
 */
export function SimSection({ settings, outflows, today }: SimSectionProps) {
  const [unlocked, setUnlocked] = useState(false);
  const handleUnlocked = useCallback(() => setUnlocked(true), []);

  // 항목이 없으면 옮길 것도 없다 — 광고도 부르지 않는다.
  if (outflows.length === 0) return null;

  return (
    <div data-testid="sim-section">
      {!unlocked && (
        <div data-testid="locked-teaser">
          <Paragraph.Text typography="t5">항목별로 가장 유리한 출금일을 찾아드려요</Paragraph.Text>
          <Spacing size={4} />
          <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
            광고를 끝까지 보면 열려요
          </Paragraph.Text>
        </div>
      )}
      <TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID ?? ''}>
        <LockedTier settings={settings} outflows={outflows} today={today} onUnlocked={handleUnlocked} />
      </TossRewardAd>
    </div>
  );
}
