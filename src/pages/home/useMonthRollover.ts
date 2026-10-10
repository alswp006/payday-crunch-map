import { useEffect, useRef } from 'react';
import type { AppMeta, LocalDate, SaveResult, YearMonth } from '@/lib/types';
import { monthOf, parseYearMonth } from '@/lib/date/localDate';

export interface UseMonthRolloverArgs {
  today: LocalDate;
  /** 설정이 있을 때만 켠다 — 온보딩 전에는 '넘어왔어요'를 띄울 이유가 없다. */
  enabled: boolean;
  meta: AppMeta | null;
  saveMeta: (meta: AppMeta) => SaveResult;
  openToast: (text: string) => void;
}

/**
 * 새 달에 처음 홈을 열면 안내 Toast를 한 번 띄우고 마지막으로 본 달을 저장한다.
 * 저장이 실패해도 화면은 그대로 둔다 — 다음 진입에서 다시 시도되는 것으로 충분하다.
 */
export function useMonthRollover({ today, enabled, meta, saveMeta, openToast }: UseMonthRolloverArgs): void {
  const month: YearMonth = monthOf(today);

  // 콜백은 매 렌더 바뀌므로 ref로 읽는다. effect는 달이 바뀔 때만 다시 돈다.
  const latest = useRef({ meta, saveMeta, openToast });
  latest.current = { meta, saveMeta, openToast };
  const handledMonth = useRef<YearMonth | null>(null);

  useEffect(() => {
    if (!enabled || handledMonth.current === month) return;
    handledMonth.current = month;

    const { meta: current, saveMeta: save, openToast: toast } = latest.current;
    const lastSeen = current?.lastSeenMonth ?? null;
    if (lastSeen === month) return;

    // 처음 여는 앱(lastSeen 없음)이나 시계가 되감긴 경우에는 알리지 않고 기록만 한다.
    if (lastSeen !== null && lastSeen < month) {
      const parsed = parseYearMonth(month);
      if (parsed) toast(`${parsed.month}월 달력으로 넘어왔어요`);
    }

    try {
      save({ version: 1, lastSeenMonth: month });
    } catch {
      // 저장소를 못 쓰는 환경 — 다음 진입에서 다시 시도한다.
    }
  }, [enabled, month]);
}
