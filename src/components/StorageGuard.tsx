// 저장소 가드 — 첫 렌더 전에 probeStorage()를 1회 부르고, 쓸 수 없으면 라우트 대신 안내 화면만 그린다(F4-AC-11).
// 메모리 전용 모드는 없다. /setup으로 보내지 않고, 광고·탭바도 그리지 않는다.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Asset, Button, Paragraph, Spacing, Top, useToast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { probeStorage } from '@/lib/store/storage';

const RETRY_FAILED_TOAST = '아직 저장 공간을 쓸 수 없어요';

function tickWeak() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export function StorageGuard({ children }: { children: ReactNode }) {
  // 지연 초기화 — 첫 렌더 전에 1회만 probe한다.
  const [available, setAvailable] = useState<boolean>(() => probeStorage());
  const { openToast } = useToast();

  if (available) return <>{children}</>;

  const retry = () => {
    tickWeak();
    if (probeStorage()) {
      setAvailable(true);
      return;
    }
    openToast(RETRY_FAILED_TOAST);
  };

  return (
    <div data-testid="storage-unavailable">
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>텅장달력</Top.TitleParagraph>} />}>
        <Spacing size={32} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Asset.ContentIcon name="icon-warning-circle" alt="" style={{ width: 48, height: 48 }} />
          <Spacing size={16} />
          <Paragraph typography="t4">저장 공간을 쓸 수 없어 달력을 만들 수 없어요</Paragraph>
          <Spacing size={8} />
          <Paragraph typography="t6" color="var(--adaptiveGrey600)">
            토스 앱을 완전히 닫았다가 다시 열어주세요
          </Paragraph>
        </div>
        <Spacing size={24} />
        <Button variant="fill" size="large" display="block" onClick={retry}>
          다시 시도
        </Button>
      </ScreenScaffold>
    </div>
  );
}
