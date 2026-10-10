import { BottomSheet, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { formatKoreanDate, formatSignedWon, formatWon } from '@/lib/format';
import type { HomeCell } from '@/lib/balance/homeModel';

export interface DayDetailSheetProps {
  open: boolean;
  /** 열린 칸. null이면 아무것도 그리지 않는다. */
  cell: HomeCell | null;
  onClose: () => void;
}

/** 날짜 칸을 탭했을 때 그날 입출금·마감 잔고·출금 후 최저를 보여 주는 바텀시트. */
export function DayDetailSheet({ open, cell, onClose }: DayDetailSheetProps) {
  if (!cell) return null;

  const { dayEvents, endBalance, lowBalance } = cell;
  const showLow = lowBalance !== null && endBalance !== null && lowBalance !== endBalance;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>{formatKoreanDate(cell.date)}</BottomSheet.Header>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 24px 24px' }}>
        {dayEvents.length === 0 ? (
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            이날은 출금·입금이 없어요
          </Paragraph.Text>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {dayEvents.map((event, i) => (
              <ListRow
                key={`${event.refId ?? 'salary'}:${i}`}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={event.name}
                    bottom={formatSignedWon(event.kind === 'salary' ? event.amount : -event.amount)}
                  />
                }
              />
            ))}
          </ul>
        )}
        <Spacing size={12} />
        {endBalance !== null && (
          <Paragraph.Text typography="t5" color="var(--adaptiveGrey900)">
            {`하루 마감 잔고 ${formatWon(endBalance)}원`}
          </Paragraph.Text>
        )}
        {showLow && (
          <>
            <Spacing size={4} />
            <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
              {`출금 후 최저 ${formatWon(lowBalance)}원`}
            </Paragraph.Text>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
