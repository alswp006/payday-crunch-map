// localStorage 키 3개 — 값 안에 version: 1을 둔다. 키 이름은 바꾸지 않는다(저장 데이터 연속성).

/** PaySettings */
export const SETTINGS_KEY = 'pcm.settings.v1';

/** OutflowStore ({ version: 1, items: Outflow[] }) */
export const OUTFLOWS_KEY = 'pcm.outflows.v1';

/** AppMeta */
export const META_KEY = 'pcm.meta.v1';

/** 앱이 쓰는 저장 키 전부 — 전체 초기화·점검처럼 키를 순회할 때 쓴다. */
export const ALL_KEYS = [SETTINGS_KEY, OUTFLOWS_KEY, META_KEY] as const;

/** 앱이 쓰는 키인지 확인한다(알 수 없는 키를 건드리지 않기 위한 가드). */
export function isAppKey(key: string): boolean {
  return (ALL_KEYS as readonly string[]).includes(key);
}
