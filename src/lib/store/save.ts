// 저장 계열 — 타입에 정의된 필드만 직렬화한다. 값 검증은 하지 않는다(읽을 때 검증).
// 예외는 던지지 않고 SaveResult로 돌려준다.
import type { AppMeta, Outflow, OutflowStore, PaySettings, SaveResult } from '@/lib/types';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from './keys';
import { classifyStorageError, writeRaw } from './storage';

function write(key: string, value: unknown): SaveResult {
  try {
    writeRaw(key, value);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: classifyStorageError(e) };
  }
}

/** 정의된 키만 복사한다. dayChange가 없으면 키 자체를 만들지 않는다. */
function pickOutflow(item: Outflow): Outflow {
  const picked: Outflow = {
    id: item.id,
    name: item.name,
    amount: item.amount,
    day: item.day,
    weekendRule: item.weekendRule,
  };
  if (item.dayChange) {
    picked.dayChange = {
      fromDay: item.dayChange.fromDay,
      effectiveMonth: item.dayChange.effectiveMonth,
    };
  }
  return picked;
}

export function saveSettings(settings: PaySettings): SaveResult {
  return write(SETTINGS_KEY, {
    version: 1,
    salaryAmount: settings.salaryAmount,
    salaryDay: settings.salaryDay,
    salaryWeekendRule: settings.salaryWeekendRule,
    currentBalance: settings.currentBalance,
    balanceAsOf: settings.balanceAsOf,
  } satisfies PaySettings);
}

export function saveOutflows(items: Outflow[]): SaveResult {
  const store: OutflowStore = { version: 1, items: items.map(pickOutflow) };
  return write(OUTFLOWS_KEY, store);
}

export function saveMeta(meta: AppMeta): SaveResult {
  return write(META_KEY, { version: 1, lastSeenMonth: meta.lastSeenMonth } satisfies AppMeta);
}
