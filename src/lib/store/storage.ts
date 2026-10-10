// 저장소 어댑터 — 앱 코드에서 window.localStorage에 닿는 곳은 이 파일 하나뿐이다.
// 예외는 여기서 삼키지 않는다(read/write/remove). 처리는 save·load 계열이 한다.
import { removeItem, setItem } from '@/lib/storage';
import { SETTINGS_KEY } from './keys';

/** 저장 실패 분류 — quota(저장 공간 부족) / unknown(그 밖 전부) */
export type StorageErrorKind = 'quota' | 'unknown';

/**
 * 저장 원문을 읽는다. 키가 없으면 null, 접근이 막혔으면 예외를 그대로 던진다.
 * 템플릿 helper의 getItem은 예외를 삼키고 JSON.parse한 값을 돌려줘서(원문·손상 구분 불가)
 * 읽기만 window.localStorage를 직접 쓴다.
 */
export function readRaw(key: string): string | null {
  return window.localStorage.getItem(key);
}

/** value를 JSON 직렬화해 쓴다(템플릿 helper 경유). 실패하면 예외를 그대로 던진다. */
export function writeRaw(key: string, value: unknown): void {
  setItem(key, value);
}

/** 키를 지운다(템플릿 helper 경유). 실패하면 예외를 그대로 던진다. */
export function removeKey(key: string): void {
  removeItem(key);
}

/** 저장소를 읽을 수 있는가. 쓰기는 시도하지 않고 예외를 밖으로 던지지 않는다. */
export function probeStorage(): boolean {
  try {
    readRaw(SETTINGS_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 저장 중 던져진 예외를 quota / unknown으로 나눈다. */
export function classifyStorageError(e: unknown): StorageErrorKind {
  if (typeof e !== 'object' || e === null) return 'unknown';
  const { name, code } = e as { name?: unknown; code?: unknown };
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  // 22: 구형 WebKit·Chromium, 1014: 구형 Firefox
  if (code === 22 || code === 1014) return 'quota';
  return 'unknown';
}
