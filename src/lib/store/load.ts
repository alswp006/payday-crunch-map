// 읽기 계열 — 저장 원문을 검증해 돌려준다. 예외는 던지지 않는다.
// 접근이 막힌 경우(readRaw 예외)에는 지우지도 다시 쓰지도 않는다. 손상 복구는 읽을 수 있을 때만 한다.
import type { AppMeta, Outflow, PaySettings } from '@/lib/types';
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from './keys';
import { readRaw, removeKey } from './storage';
import { saveOutflows } from './save';
import { normalizeOutflows, parseMeta, parseOutflowContainer, parseSettings } from './validate';

type Read =
  | { state: 'blocked' }
  | { state: 'missing' }
  | { state: 'corrupt' }
  | { state: 'ok'; value: unknown };

function read(key: string): Read {
  let raw: string | null;
  try {
    raw = readRaw(key);
  } catch {
    return { state: 'blocked' };
  }
  if (raw === null) return { state: 'missing' };
  try {
    return { state: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { state: 'corrupt' };
  }
}

/** 키를 지운다. 실패해도 호출자는 이미 복구된 값을 돌려주므로 삼킨다. */
function drop(key: string): void {
  try {
    removeKey(key);
  } catch {
    // 지우지 못해도 다음 load에서 같은 손상으로 다시 복구된다.
  }
}

export function loadSettings(): { settings: PaySettings | null; recovered: boolean } {
  const r = read(SETTINGS_KEY);
  if (r.state === 'blocked' || r.state === 'missing') return { settings: null, recovered: false };
  const settings = r.state === 'ok' ? parseSettings(r.value) : null;
  if (settings) return { settings, recovered: false };
  drop(SETTINGS_KEY);
  return { settings: null, recovered: true };
}

export function loadOutflows(): { items: Outflow[]; recovered: boolean } {
  const r = read(OUTFLOWS_KEY);
  if (r.state === 'blocked' || r.state === 'missing') return { items: [], recovered: false };

  const rawItems = r.state === 'ok' ? parseOutflowContainer(r.value) : null;
  if (!rawItems) {
    drop(OUTFLOWS_KEY);
    return { items: [], recovered: true };
  }

  const { items, filtered } = normalizeOutflows(rawItems);
  if (!filtered) return { items, recovered: false };

  // 다시 저장이 실패해도 같은 값을 돌려준다(saveOutflows는 던지지 않는다).
  saveOutflows(items);
  return { items, recovered: true };
}

/** 메타는 손상돼도 키를 지우지 않는다 — 홈이 곧바로 현재 달로 덮어쓴다. */
export function loadMeta(): AppMeta | null {
  const r = read(META_KEY);
  return r.state === 'ok' ? parseMeta(r.value) : null;
}
