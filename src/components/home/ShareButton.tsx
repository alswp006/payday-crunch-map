import { Button, useToast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { logClick } from '@/lib/analytics';
import { shareApp } from '@/lib/share';

function fireSuccessHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    // WebView 밖에서는 브릿지가 없다 — 조용히 넘어간다.
  }
}

/** 홈 하단 공유 버튼. 공유가 실패해도 화면은 그대로 두고 토스트만 띄운다. */
export function ShareButton() {
  const { openToast } = useToast();

  const handleClick = () => {
    fireSuccessHaptic();
    logClick('share_calendar');
    try {
      Promise.resolve(shareApp({ message: '내 월급 전 잔고, 달력으로 미리 봤어요', path: '/' })).catch(() => {
        openToast('공유하지 못했어요');
      });
    } catch {
      openToast('공유하지 못했어요');
    }
  };

  return (
    <Button variant="weak" size="large" display="block" onClick={handleClick}>
      내 잔고 달력 공유하기
    </Button>
  );
}
