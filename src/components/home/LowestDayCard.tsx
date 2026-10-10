import { useEffect, useRef } from 'react';
import { Badge, Spacing } from '@toss/tds-mobile';
import { SummaryHero } from '@/components/SummaryHero';
import { CountUp } from '@/components/CountUp';
import { Sparkline } from '@/components/Sparkline';
import { logImpression } from '@/lib/analytics';
import { formatKoreanDate, formatWon } from '@/lib/format';
import { parseLocalDate } from '@/lib/date/localDate';
import type { HomeSparkline } from '@/lib/balance/homeModel';
import type { LocalDate, MonthSummary } from '@/lib/types';

export interface LowestDayCardProps {
  summary: MonthSummary;
  /** 카드 제목 앞머리 — '이번 달' 또는 '11월' */
  monthLabel: string;
  sparkline: HomeSparkline;
}

/** '2026-10-24' → '10월 24일' (요일 없이) */
function monthDay(date: LocalDate): string {
  const p = parseLocalDate(date);
  return p ? `${p.month}월 ${p.day}일` : date;
}

function crunchCaption(summary: MonthSummary): string | null {
  const { lowest, firstNegativeDate, crunch } = summary;
  if (lowest && firstNegativeDate) {
    return `${monthDay(firstNegativeDate)}부터 마이너스예요 · ${formatWon(-lowest.balance)}원 부족`;
  }
  if (!crunch) return null;
  if (crunch.days <= 1) return `월급 전 최저 구간 ${monthDay(crunch.start)} 하루`;
  return `월급 전 최저 구간 ${monthDay(crunch.start)} ~ ${monthDay(crunch.end)} (${crunch.days}일)`;
}

/** 이번 달 최저 잔고일 카드. 값은 모두 summary·sparkline에서 받고 계산하지 않는다. */
export function LowestDayCard({ summary, monthLabel, sparkline }: LowestDayCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = summary.lowest !== null;

  // 뷰포트에 들어온 시점에 1회. StrictMode의 effect 이중 실행에도 한 번만 남기도록 ref로 막는다.
  const logged = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!visible || !el || logged.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (logged.current || !entries.some((e) => e.isIntersecting)) return;
        logged.current = true;
        logImpression('lowest_day_card');
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const { lowest, firstNegativeDate } = summary;
  if (!lowest) return null;

  const caption = crunchCaption(summary);
  const hasData = sparkline.points.length >= 2;

  return (
    <div ref={ref} data-testid="lowest-day-card">
      <SummaryHero
        label={`${monthLabel} 최저 잔고일 · ${formatKoreanDate(lowest.date)}`}
        value={<CountUp value={lowest.balance} unit="원" typography="t2" />}
        caption={caption}
        action={
          <div>
            {firstNegativeDate !== null && (
              <div>
                <Badge size="small" variant="weak" color="red">
                  잔고 부족
                </Badge>
              </div>
            )}
            {hasData && (
              <>
                {firstNegativeDate !== null && <Spacing size={12} />}
                <Sparkline
                  testId="balance-sparkline"
                  data={sparkline.points}
                  markIndex={sparkline.minIndex}
                  height={56}
                />
              </>
            )}
          </div>
        }
      />
    </div>
  );
}
