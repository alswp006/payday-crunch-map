// 읽을 때 검증·정규화 — 저장소에 접근하지 않는 순수 함수만 둔다.
// 통과한 값은 타입에 정의된 키만 복사해 돌려준다(저장 값의 추가 필드는 버린다).
import { isValidLocalDate, isValidYearMonth } from '@/lib/date/localDate';
import type { AppMeta, Outflow, PaySettings, WeekendRule } from '@/lib/types';

/** 출금 항목 최대 개수 */
export const MAX_OUTFLOWS = 30;

const WEEKEND_RULES: readonly string[] = ['none', 'prevBusinessDay', 'nextBusinessDay'];

/** JSON.parse가 만드는 일반 객체인가(null·배열·원시값 제외). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** min ≤ x ≤ max 인 정수인가. */
export function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isWeekendRule(value: unknown): value is WeekendRule {
  return typeof value === 'string' && WEEKEND_RULES.includes(value);
}

/** PaySettings 검증. 하나라도 실패하면 null — 부분 복구는 하지 않는다. */
export function parseSettings(value: unknown): PaySettings | null {
  if (!isPlainObject(value) || value.version !== 1) return null;
  const { salaryAmount, salaryDay, salaryWeekendRule, currentBalance, balanceAsOf } = value;
  if (!isIntInRange(salaryAmount, 1, 1_000_000_000)) return null;
  if (!isIntInRange(salaryDay, 1, 31)) return null;
  if (!isWeekendRule(salaryWeekendRule)) return null;
  if (!isIntInRange(currentBalance, 0, 9_999_999_999)) return null;
  if (!isValidLocalDate(balanceAsOf)) return null;
  return { version: 1, salaryAmount, salaryDay, salaryWeekendRule, currentBalance, balanceAsOf };
}

/** 출금 컨테이너 검증. 통과하면 items 원본 배열, 실패하면 null. */
export function parseOutflowContainer(value: unknown): unknown[] | null {
  if (!isPlainObject(value) || value.version !== 1) return null;
  return Array.isArray(value.items) ? value.items : null;
}

/** 출금 항목 하나 검증. seenIds는 앞서 통과한 항목의 id(중복 판정용). */
export function parseOutflow(value: unknown, seenIds: ReadonlySet<string>): Outflow | null {
  if (!isPlainObject(value)) return null;
  const { id, name, amount, day, weekendRule, dayChange } = value;
  if (typeof id !== 'string' || id.length < 1 || id.length > 32 || seenIds.has(id)) return null;
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 20) return null;
  if (!isIntInRange(amount, 1, 100_000_000)) return null;
  if (!isIntInRange(day, 1, 31)) return null;
  if (!isWeekendRule(weekendRule)) return null;

  const item: Outflow = { id, name, amount, day, weekendRule };
  if (Object.prototype.hasOwnProperty.call(value, 'dayChange')) {
    if (!isPlainObject(dayChange)) return null;
    const { fromDay, effectiveMonth } = dayChange;
    if (!isIntInRange(fromDay, 1, 31) || !isValidYearMonth(effectiveMonth)) return null;
    item.dayChange = { fromDay, effectiveMonth };
  }
  return item;
}

/**
 * 항목 배열을 걸러 낸다 — 실패한 항목만 빼고, 30개를 넘으면 앞 30개만 남긴다.
 * filtered: 하나라도 걸러 냈는가(다시 저장해야 하는가).
 */
export function normalizeOutflows(rawItems: unknown[]): { items: Outflow[]; filtered: boolean } {
  const items: Outflow[] = [];
  const seenIds = new Set<string>();
  let filtered = false;
  for (const raw of rawItems) {
    const item = parseOutflow(raw, seenIds);
    if (!item) {
      filtered = true;
      continue;
    }
    if (items.length >= MAX_OUTFLOWS) {
      filtered = true;
      break;
    }
    seenIds.add(item.id);
    items.push(item);
  }
  return { items, filtered };
}

/** AppMeta 검증. 실패하면 null. */
export function parseMeta(value: unknown): AppMeta | null {
  if (!isPlainObject(value) || value.version !== 1) return null;
  const { lastSeenMonth } = value;
  if (lastSeenMonth !== null && !isValidYearMonth(lastSeenMonth)) return null;
  return { version: 1, lastSeenMonth };
}
