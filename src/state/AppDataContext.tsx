// 앱 데이터 상태 — settings·outflows·meta를 한 번 읽어 들고, 변경은 저장이 ok일 때만 state에 반영한다.
// 저장 전 폼 입력은 여기 두지 않는다(각 화면 컴포넌트 state). Toast 같은 알림은 호출한 UI가 띄운다.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppMeta, LocalDate, Outflow, PaySettings, SaveResult } from '@/lib/types';
import { applyDayChangeToItem } from '@/lib/balance/dayChange';
import { loadMeta, loadOutflows, loadSettings } from '@/lib/store/load';
import { saveMeta as persistMeta, saveOutflows, saveSettings as persistSettings } from '@/lib/store/save';
import { newId } from '@/lib/store/id';

/** 새 출금 항목 입력 — id와 날짜 변경 시점은 저장 계층이 아니라 이 컨텍스트가 정한다. */
export type OutflowInput = Pick<Outflow, 'name' | 'amount' | 'day' | 'weekendRule'>;

/** 출금 항목 수정 입력 — 날짜(day)는 별도 인자로 받아 적용 시점 규칙을 거친다. */
export type OutflowPatch = Partial<Pick<Outflow, 'name' | 'amount' | 'weekendRule'>>;

interface AppData {
  settings: PaySettings | null;
  outflows: Outflow[];
  meta: AppMeta | null;
  /** 설정 저장 값이 손상돼 지워졌는가 */
  settingsRecovered: boolean;
  /** 출금 저장 값이 손상돼 일부 또는 전부를 걸러 냈는가 */
  outflowsRecovered: boolean;
}

export interface AppDataContextValue extends AppData {
  saveSettings: (settings: PaySettings) => SaveResult;
  addOutflow: (input: OutflowInput) => SaveResult;
  /** 같은 인덱스를 교체한다. newDay는 applyDayChangeToItem 규칙(이번 달 이미 지났으면 다음 달부터)을 따른다. */
  updateOutflow: (id: string, patch: OutflowPatch, newDay: number, today: LocalDate) => SaveResult;
  removeOutflow: (id: string) => SaveResult;
  /** 이름·금액은 그대로 두고 날짜만 옮긴다(시뮬레이션 적용). */
  setOutflowDay: (id: string, newDay: number, today: LocalDate) => SaveResult;
  saveMeta: (meta: AppMeta) => SaveResult;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function loadAll(): AppData {
  const s = loadSettings();
  const o = loadOutflows();
  return {
    settings: s.settings,
    outflows: o.items,
    meta: loadMeta(),
    settingsRecovered: s.recovered,
    outflowsRecovered: o.recovered,
  };
}

const NOT_FOUND: SaveResult = { ok: false, error: 'unknown' };

export function AppDataProvider({ children }: { children: ReactNode }) {
  // 마운트 시 1회만 읽는다 — 이후 변경은 액션만 거친다.
  const [data, setData] = useState<AppData>(loadAll);
  // 같은 틱에 액션이 연달아 불려도 최신 값을 보도록 동기 사본을 둔다. state 갱신과 항상 함께 바꾼다.
  const latest = useRef<AppData>(data);

  const commit = useCallback((patch: Partial<AppData>) => {
    latest.current = { ...latest.current, ...patch };
    setData(latest.current);
  }, []);

  const saveSettings = useCallback(
    (settings: PaySettings): SaveResult => {
      const result = persistSettings(settings);
      if (result.ok) commit({ settings });
      return result;
    },
    [commit],
  );

  /** 항목 배열을 저장하고, 성공했을 때만 state에 반영한다. 실패하면 배열 참조는 그대로다. */
  const writeOutflows = useCallback(
    (next: Outflow[]): SaveResult => {
      const result = saveOutflows(next);
      if (result.ok) commit({ outflows: next });
      return result;
    },
    [commit],
  );

  const addOutflow = useCallback(
    (input: OutflowInput): SaveResult => {
      const item: Outflow = {
        id: newId(),
        name: input.name,
        amount: input.amount,
        day: input.day,
        weekendRule: input.weekendRule,
      };
      return writeOutflows([...latest.current.outflows, item]);
    },
    [writeOutflows],
  );

  const replaceAt = useCallback(
    (id: string, build: (item: Outflow) => Outflow): SaveResult => {
      const list = latest.current.outflows;
      const index = list.findIndex((o) => o.id === id);
      if (index < 0) return NOT_FOUND;
      const next = list.slice();
      next[index] = build(list[index]);
      return writeOutflows(next);
    },
    [writeOutflows],
  );

  const updateOutflow = useCallback(
    (id: string, patch: OutflowPatch, newDay: number, today: LocalDate): SaveResult =>
      replaceAt(id, (item) =>
        applyDayChangeToItem(
          {
            ...item,
            name: patch.name ?? item.name,
            amount: patch.amount ?? item.amount,
            weekendRule: patch.weekendRule ?? item.weekendRule,
          },
          newDay,
          today,
        ),
      ),
    [replaceAt],
  );

  const setOutflowDay = useCallback(
    (id: string, newDay: number, today: LocalDate): SaveResult =>
      replaceAt(id, (item) => applyDayChangeToItem(item, newDay, today)),
    [replaceAt],
  );

  const removeOutflow = useCallback(
    (id: string): SaveResult => {
      const list = latest.current.outflows;
      if (!list.some((o) => o.id === id)) return NOT_FOUND;
      return writeOutflows(list.filter((o) => o.id !== id));
    },
    [writeOutflows],
  );

  const saveMeta = useCallback(
    (meta: AppMeta): SaveResult => {
      const result = persistMeta(meta);
      if (result.ok) commit({ meta });
      return result;
    },
    [commit],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...data,
      saveSettings,
      addOutflow,
      updateOutflow,
      removeOutflow,
      setOutflowDay,
      saveMeta,
    }),
    [data, saveSettings, addOutflow, updateOutflow, removeOutflow, setOutflowDay, saveMeta],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData는 AppDataProvider 안에서만 쓸 수 있어요');
  return ctx;
}
