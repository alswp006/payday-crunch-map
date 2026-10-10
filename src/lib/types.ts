// 도메인 타입 — 저장 스키마(PaySettings·OutflowStore·AppMeta)와 계산 엔진 출력 타입.
// 런타임 코드는 두지 않는다. 판정식·상수는 각 모듈에서 둔다.

/** 주말 보정: 'none'은 그대로, 나머지는 토·일일 때 직전/직후 영업일로 옮긴다(공휴일 미반영). */
export type WeekendRule = 'none' | 'prevBusinessDay' | 'nextBusinessDay';

/** 'YYYY-MM-DD' */
export type LocalDate = string;

/** 'YYYY-MM' */
export type YearMonth = string;

/** 월급·잔고 설정 — localStorage 키 'pcm.settings.v1' */
export interface PaySettings {
  version: 1;
  /** 정수, 1 ~ 1,000,000,000 */
  salaryAmount: number;
  /** 정수, 1 ~ 31 */
  salaryDay: number;
  salaryWeekendRule: WeekendRule;
  /** 정수, 0 ~ 9,999,999,999 (오늘 입출금이 반영된 잔고) */
  currentBalance: number;
  /** 잔고 기준일 — 이 날의 이벤트는 이미 반영된 것으로 보고 투영에서 제외 */
  balanceAsOf: LocalDate;
}

/** 출금 항목 묶음 — localStorage 키 'pcm.outflows.v1'. 최대 30개 */
export interface OutflowStore {
  version: 1;
  /** 배열 순서 = 등록 순서 */
  items: Outflow[];
}

/** 사용자 등록 출금 항목 */
export interface Outflow {
  /** 1 ~ 32자 */
  id: string;
  /** trim 후 1 ~ 20자 */
  name: string;
  /** 정수, 1 ~ 100,000,000 */
  amount: number;
  /** 정수, 1 ~ 31 (짧은 달은 말일 보정) */
  day: number;
  weekendRule: WeekendRule;
  /** 날짜 변경 적용 시점. 없으면 키 자체가 없다. */
  dayChange?: {
    /** 정수, 1 ~ 31. effectiveMonth 이전 달에 쓰는 원래 날짜 */
    fromDay: number;
    /** 이 달부터 day 적용 */
    effectiveMonth: YearMonth;
  };
}

/** 앱 상태 — localStorage 키 'pcm.meta.v1' */
export interface AppMeta {
  version: 1;
  /** 마지막으로 홈을 본 달 */
  lastSeenMonth: YearMonth | null;
}

/** 하루에 일어나는 입출금 한 건 (계산 엔진 출력, 저장하지 않음) */
export interface DayEvent {
  kind: 'salary' | 'outflow';
  /** outflow.id, 월급은 null */
  refId: string | null;
  /** outflow.name 또는 '월급' */
  name: string;
  /** 양수 */
  amount: number;
  /** 등록한 날짜 */
  scheduledDay: number;
  /** 말일·주말 보정 후 날짜 */
  actualDate: LocalDate;
  /** 보정으로 날짜가 바뀌었는지 */
  shifted: boolean;
}

/** 하루치 예상 잔고 */
export interface DayBalance {
  date: LocalDate;
  events: DayEvent[];
  /** 시작잔고 − 그날 출금 합 (입금 전) */
  lowBalance: number;
  /** lowBalance + 그날 월급 */
  endBalance: number;
}

/** 한 달 요약 */
export interface MonthSummary {
  month: YearMonth;
  /** 범위 내 lowBalance 최소, 동률이면 가장 이른 날 */
  lowest: { date: LocalDate; balance: number } | null;
  crunch: { start: LocalDate; end: LocalDate; days: number } | null;
  /** 범위 내 lowBalance < 0인 첫 날 */
  firstNegativeDate: LocalDate | null;
}

/** 출금일 이동 시뮬레이션 결과 */
export interface SimResult {
  itemId: string;
  name: string;
  fromDay: number;
  toDay: number;
  /** 변경 전 시뮬레이션 구간 최저 잔고 */
  baseMin: number;
  /** 변경 후 */
  newMin: number;
  /** newMin − baseMin */
  delta: number;
  /** delta > 0 */
  improved: boolean;
}

/** 저장 결과 — 예외 대신 값으로 돌려준다 */
export type SaveResult = { ok: true } | { ok: false; error: 'quota' | 'unknown' };
