import { Paragraph } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { formatCompactWon, formatKoreanDate } from '@/lib/format';
import { parseLocalDate } from '@/lib/date/localDate';
import type { HomeCell, HomeModel } from '@/lib/balance/homeModel';
import './CalendarGrid.css';

const WEEKDAY_HEADS = ['일', '월', '화', '수', '목', '금', '토'];

const RED_TEXT = 'var(--adaptiveRed500)';
const CRUNCH_BG = 'var(--adaptiveRed50)';
const PAST_TEXT = 'var(--adaptiveGrey400)';
const SUB_TEXT = 'var(--adaptiveGrey600)';
const BODY_TEXT = 'var(--adaptiveGrey900)';

const CELL_STYLE = {
  minHeight: 48,
  borderRadius: 8,
  border: 'none',
  textAlign: 'center',
  cursor: 'pointer',
} as const;

const NO_WRAP = { whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

export interface CalendarGridProps {
  model: HomeModel;
  /** cell.tappable인 칸을 탭했을 때만 호출한다. */
  onDayClick?: (cell: HomeCell) => void;
}

function dayNumber(date: string): number {
  return parseLocalDate(date)?.day ?? 0;
}

function CellBody({ cell }: { cell: HomeCell }) {
  const name = cell.names[0];
  const nameColor = cell.isPast ? PAST_TEXT : SUB_TEXT;
  const balanceColor = cell.isNegative ? RED_TEXT : BODY_TEXT;

  return (
    <>
      <Paragraph.Text typography="t7" color={cell.isPast ? PAST_TEXT : BODY_TEXT}>
        {dayNumber(cell.date)}
      </Paragraph.Text>
      {name !== undefined && (
        <span style={{ display: 'inline-flex', maxWidth: '100%', alignItems: 'baseline', gap: 2 }}>
          <span style={{ minWidth: 0, ...NO_WRAP }}>
            <Paragraph.Text typography="st13" color={nameColor}>
              {name}
            </Paragraph.Text>
          </span>
          {cell.moreCount > 0 && (
            <Paragraph.Text typography="st13" color={nameColor}>
              {`+${cell.moreCount}`}
            </Paragraph.Text>
          )}
        </span>
      )}
      {cell.showBalance && cell.endBalance !== null && (
        <span style={NO_WRAP}>
          <Paragraph.Text typography="st13" color={balanceColor}>
            {formatCompactWon(cell.endBalance)}
          </Paragraph.Text>
        </span>
      )}
    </>
  );
}

/** 달 전체 잔고 달력. 계산은 하지 않고 model.cells·leadingBlanks만 그린다. */
export function CalendarGrid({ model, onDayClick }: CalendarGridProps) {
  return (
    <Card>
      <div className="calendar-grid" data-testid="calendar-grid">
        {WEEKDAY_HEADS.map((label) => (
          <div key={label} className="calendar-grid__head">
            <Paragraph.Text typography="t7" color={SUB_TEXT}>
              {label}
            </Paragraph.Text>
          </div>
        ))}
        {Array.from({ length: model.leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {model.cells.map((cell) => {
          const common = {
            className: 'calendar-grid__cell',
            'data-testid': `day-cell-${cell.date}`,
            'data-crunch': cell.inCrunch ? 'true' : 'false',
            'data-lowest': cell.isLowest ? 'true' : 'false',
          } as const;
          const style = {
            ...CELL_STYLE,
            backgroundColor: cell.inCrunch ? CRUNCH_BG : 'transparent',
          };

          if (!cell.tappable) {
            return (
              <div key={cell.date} {...common} style={{ ...style, cursor: 'default' }}>
                <CellBody cell={cell} />
              </div>
            );
          }
          return (
            <button
              key={cell.date}
              {...common}
              type="button"
              style={style}
              aria-label={`${formatKoreanDate(cell.date)} 상세 보기`}
              onClick={() => onDayClick?.(cell)}
            >
              <CellBody cell={cell} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
