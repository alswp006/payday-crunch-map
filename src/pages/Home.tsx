import { useEffect, useMemo, useRef, useState } from 'react';
import { Asset, Button, ListRow, Spacing, Tab, Top, useToast } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { CalendarGrid } from '@/components/home/CalendarGrid';
import { DayDetailSheet } from '@/components/home/DayDetailSheet';
import { LowestDayCard } from '@/components/home/LowestDayCard';
import { ScheduleList } from '@/components/home/ScheduleList';
import { ShareButton } from '@/components/home/ShareButton';
import { SimSection } from '@/components/home/SimSection';
import { useAppData } from '@/state/AppDataContext';
import { useMonthRollover } from '@/pages/home/useMonthRollover';
import { buildHomeModel } from '@/lib/balance/homeModel';
import type { HomeCell } from '@/lib/balance/homeModel';
import { logClick } from '@/lib/analytics';
import { addMonths, monthOf, parseLocalDate, parseYearMonth } from '@/lib/date/localDate';
import { getToday } from '@/lib/date/getToday';
import type { ItemsRouteState, SetupRouteState } from '@/types/nav';
import type { LocalDate } from '@/lib/types';

const RECOVERED_TOAST = '저장된 정보를 불러오지 못해 다시 입력이 필요해요';
const OUTFLOWS_RECOVERED_TOAST = '일부 출금 항목을 불러오지 못했어요';

/** '2026-10-11' → '10월 11일' */
function monthDayLabel(date: LocalDate): string {
  const p = parseLocalDate(date);
  return p ? `${p.month}월 ${p.day}일` : date;
}

export default function Home() {
  const navigate = useNavigate();
  const { openToast } = useToast();
  const { settings, outflows, meta, settingsRecovered, outflowsRecovered, saveMeta } = useAppData();

  const today = getToday();
  const [monthIdx, setMonthIdx] = useState(0);
  const [sheet, setSheet] = useState<{ date: LocalDate; open: boolean } | null>(null);

  // 설정이 없으면 온보딩으로 보낸다. 손상 복구였을 때만 이유를 알린다.
  const redirected = useRef(false);
  const hasSettings = settings !== null;
  useEffect(() => {
    if (hasSettings || redirected.current) return;
    redirected.current = true;
    if (settingsRecovered) openToast(RECOVERED_TOAST);
    navigate('/setup', { replace: true, state: { mode: 'onboarding' } satisfies SetupRouteState });
  }, [hasSettings, settingsRecovered, openToast, navigate]);

  // 출금 항목이 손상돼 걸러졌으면 홈 진입 시 1회만 알린다.
  const outflowsToasted = useRef(false);
  useEffect(() => {
    if (!hasSettings || !outflowsRecovered || outflowsToasted.current) return;
    outflowsToasted.current = true;
    openToast(OUTFLOWS_RECOVERED_TOAST);
  }, [hasSettings, outflowsRecovered, openToast]);

  useMonthRollover({ today, enabled: hasSettings, meta, saveMeta, openToast });

  const thisMonth = monthOf(today);
  const nextMonth = addMonths(thisMonth, 1);
  const viewMonth = monthIdx === 0 ? thisMonth : nextMonth;
  const thisLabel = parseYearMonth(thisMonth)?.month ?? 0;
  const nextLabel = parseYearMonth(nextMonth)?.month ?? 0;

  const model = useMemo(
    () => (settings ? buildHomeModel({ settings, outflows, today, month: viewMonth }) : null),
    [settings, outflows, today, viewMonth],
  );

  if (!settings || !model) return null;

  const tooOld = model.balanceHidden;
  const noOutflows = outflows.length === 0;
  const showCard = !tooOld && !noOutflows && model.summary.lowest !== null;
  const showSim = !tooOld && !noOutflows;
  const adGroupId: string | undefined = import.meta.env.VITE_TOSS_AD_GROUP_ID;
  const sheetCell: HomeCell | null = sheet ? (model.cells.find((c) => c.date === sheet.date) ?? null) : null;

  const goSetup = (state: SetupRouteState) => navigate('/setup', { state });
  const goBalance = () => {
    logClick('stale_balance_tap');
    goSetup({ mode: 'edit', focus: 'balance' });
  };

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>텅장달력</Top.TitleParagraph>}
          right={
            <Button
              variant="weak"
              size="small"
              onClick={() => {
                logClick('setup_edit');
                goSetup({ mode: 'edit' });
              }}
            >
              월급·잔고
            </Button>
          }
        />
      }
    >
      <Tab
        onChange={(i) => {
          setMonthIdx(i === 1 ? 1 : 0);
          setSheet(null);
        }}
      >
        <Tab.Item selected={monthIdx === 0}>{`이번 달 (${thisLabel}월)`}</Tab.Item>
        <Tab.Item selected={monthIdx === 1}>{`다음 달 (${nextLabel}월)`}</Tab.Item>
      </Tab>
      <Spacing size={16} />

      <div data-testid="free-tier">
        {model.isStale && !tooOld && (
          <>
            <ListRow
              data-testid="stale-balance-row"
              withArrow
              onClick={goBalance}
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={`잔고 기준일이 ${monthDayLabel(settings.balanceAsOf)}이에요`}
                  bottom="지금 잔고로 바꾸기"
                />
              }
            />
            <Spacing size={16} />
          </>
        )}

        {tooOld ? (
          <EmptyState
            testId="too-old-panel"
            icon={<Asset.ContentIcon name="icon-warning-circle" alt="" style={{ width: 48, height: 48 }} />}
            title={`잔고 기준일이 너무 오래됐어요 (${monthDayLabel(settings.balanceAsOf)})`}
            description="지금 잔고를 넣으면 월급 전 최저 잔고일을 다시 찍어드려요"
            action={
              <div style={{ width: '100%' }}>
                <Button variant="fill" size="large" display="block" onClick={goBalance}>
                  지금 잔고 입력
                </Button>
              </div>
            }
          />
        ) : noOutflows ? (
          <EmptyState
            testId="empty-panel"
            icon={<Asset.ContentIcon name="icon-plus-small-mono" alt="" style={{ width: 48, height: 48 }} />}
            title="출금 항목을 등록하면 잔고가 얇아지는 날을 찍어드려요"
            action={
              <div style={{ width: '100%' }}>
                <Button
                  variant="fill"
                  size="large"
                  display="block"
                  onClick={() => {
                    logClick('empty_add_outflow');
                    navigate('/items', { state: { openAdd: true } satisfies ItemsRouteState });
                  }}
                >
                  출금 항목 추가
                </Button>
              </div>
            }
          />
        ) : (
          <LowestDayCard
            summary={model.summary}
            monthLabel={monthIdx === 0 ? '이번 달' : `${nextLabel}월`}
            sparkline={model.sparkline}
          />
        )}

        <Spacing size={16} />
        <CalendarGrid model={model} onDayClick={(cell) => setSheet({ date: cell.date, open: true })} />
        <Spacing size={16} />
        <ScheduleList rows={model.rows} />
      </div>

      {adGroupId ? (
        <>
          <Spacing size={16} />
          <AdSlot adGroupId={adGroupId} />
        </>
      ) : null}

      {showSim ? (
        <>
          <Spacing size={16} />
          <SimSection settings={settings} outflows={outflows} today={today} />
        </>
      ) : null}

      {showCard ? (
        <>
          <Spacing size={24} />
          <ShareButton />
        </>
      ) : null}
      <Spacing size={24} />

      <DayDetailSheet
        open={sheet?.open === true}
        cell={sheetCell}
        onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))}
      />
    </ScreenScaffold>
  );
}
