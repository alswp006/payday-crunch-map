import { useMemo } from 'react';
import { ListRow, Paragraph } from '@toss/tds-mobile';
import { formatWon } from '@/lib/format';
import type { Outflow, WeekendRule } from '@/lib/types';

const WEEKEND_LABEL: Record<WeekendRule, string> = {
  none: '그대로',
  prevBusinessDay: '직전 평일',
  nextBusinessDay: '다음 평일',
};

export interface OutflowListProps {
  /** 저장 순서(등록 순) 그대로. 화면 정렬은 여기서만 한다. */
  items: Outflow[];
  onSelect: (item: Outflow) => void;
}

/** day 오름차순, 같은 날이면 등록 순(sort는 안정 정렬). 원본 배열은 바꾸지 않는다. */
export function sortByDay(items: Outflow[]): Outflow[] {
  return items.slice().sort((a, b) => a.day - b.day);
}

/** 월급 대비 출금 합계 비율(정수 %). 월급이 없으면 null. */
export function outflowRatioPercent(total: number, salaryAmount: number | null | undefined): number | null {
  if (!salaryAmount || salaryAmount <= 0) return null;
  return Math.round((total / salaryAmount) * 100);
}

/** 출금 항목 목록. 행을 탭하면 수정 시트를 연다. */
export function OutflowList({ items, onSelect }: OutflowListProps) {
  const sorted = useMemo(() => sortByDay(items), [items]);

  return (
    <div data-testid="outflow-list">
      {sorted.map((item) => (
        <ListRow
          key={item.id}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={item.name}
              bottom={`매월 ${item.day}일 · 주말이면 ${WEEKEND_LABEL[item.weekendRule] ?? WEEKEND_LABEL.none}`}
            />
          }
          right={<Paragraph.Text typography="t6">{`${formatWon(item.amount)}원`}</Paragraph.Text>}
          withArrow
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  );
}
