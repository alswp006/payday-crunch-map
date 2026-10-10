import { ListRow } from '@toss/tds-mobile';
import type { HomeRow } from '@/lib/balance/homeModel';

export interface ScheduleListProps {
  /** buildHomeModel이 만든 행. 문자열은 그대로 그린다. */
  rows: HomeRow[];
}

/** 그 달의 입출금 일정. 행 문자열은 모델이 만들고, 여기서는 그리기만 한다. */
export function ScheduleList({ rows }: ScheduleListProps) {
  return (
    <div data-testid="schedule-list">
      {rows.map((row) => (
        <ListRow
          key={row.key}
          contents={<ListRow.Texts type="2RowTypeA" top={row.label} bottom={row.sub} />}
        />
      ))}
    </div>
  );
}
