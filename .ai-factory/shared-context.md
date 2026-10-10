# Shared Context (auto-generated — do NOT modify)


## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    analytics.ts
    balance/
    date/
    format.test.ts
    format.ts
    review.ts
    share.ts
    storage.ts
    store/
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    Items.tsx
    Setup.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  test/
    fixtures.test.ts
    fixtures.ts
    setup.ts
  types/
    nav.ts
  vite-env.d.ts

### Exports (src/lib/)
- analytics.ts: export type LogFields = Record<string, string | number | boolean | null>; export const DWELL_MS = 3000; export function fireAndForget(call: () => unknown): void; export function logScreen(page: string, extra?: LogFields): void; export function logClick(name: string, extra?: LogFields): void; export function logImpression(name: string, extra?: LogFields): void; export function useScreenLog(page: string): void
- balance/dayChange.ts: export function applyDayChange( item: Pick<Outflow, 'name' | 'day' | 'dayChange'>, newDay: number, today: LocalDate, ):; export function applyDayChangeToItem(item: Outflow, newDay: number, today: LocalDate): Outflow
- balance/events.ts: export interface DayOverride; export function collectEvents(args:; export function buildMonthEvents(args: EventArgs): DayEvent[]
- balance/homeModel.ts: export interface HomeCell; export interface HomeRow; export interface HomeSparkline; export interface HomeModel; export function buildHomeModel(args:
- balance/projection.ts: export function buildProjection(args:
- balance/resolveActualDate.ts: export function resolveActualDate(year: number, month: number, day: number, rule: WeekendRule): LocalDate
- balance/simulate.ts: export function simulateShift( settings: PaySettings, outflows: Outflow[], itemId: string, toDay: number, today: LocalDa; export function bestShifts(settings: PaySettings, outflows: Outflow[], today: LocalDate): SimResult[]
- balance/summary.ts: export function summarizeMonth(days: DayBalance[], month: YearMonth, today: LocalDate): MonthSummary
- date/getToday.ts: export function getToday(): LocalDate
- date/localDate.ts: export function daysInMonth(year: number, month: number): number; export function toLocalDate(year: number, month: number, day: number): LocalDate; export function parseLocalDate(date: LocalDate):; export function parseYearMonth(ym: YearMonth):; export function isValidLocalDate(value: unknown): value is LocalDate; export function isValidYearMonth(value: unknown): value is YearMonth; export function monthOf(date: LocalDate): YearMonth; export function addMonths(ym: YearMonth, n: number): YearMonth
- format.ts: export function formatWon(n: number): string; export function formatSignedWon(n: number): string; export function formatCompactWon(n: number): string; export function formatKoreanDate(date: LocalDate): string
- review.ts: export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void
- share.ts: export interface ShareAppOptions; export async function shareApp(opts: ShareAppOptions): Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- store/id.ts: export function newId(): string
- store/keys.ts: export const SETTINGS_KEY = 'pcm.settings.v1'; export const OUTFLOWS_KEY = 'pcm.outflows.v1'; export const META_KEY = 'pcm.meta.v1'; export const ALL_KEYS = [SETTINGS_KEY, OUTFLOWS_KEY, META_KEY] as const; export function isAppKey(key: string): boolean
- store/load.ts: export function loadSettings():; export function loadOutflows():; export function loadMeta(): AppMeta | null
- store/save.ts: export function saveSettings(settings: PaySettings): SaveResult; export function saveOutflows(items: Outflow[]): SaveResult; export function saveMeta(meta: AppMeta): SaveResult
- store/storage.ts: export type StorageErrorKind = 'quota' | 'unknown'; export function readRaw(key: string): string | null; export function writeRaw(key: string, value: unknown): void; export function removeKey(key: string): void; export function probeStorage(): boolean; export function classifyStorageError(e: unknown): StorageErrorKind
- store/validate.ts: export const MAX_OUTFLOWS = 30; export function isPlainObject(value: unknown): value is Record<string, unknown>; export function isIntInRange(value: unknown, min: number, max: number): value is number; export function isWeekendRule(value: unknown): value is WeekendRule; export function parseSettings(value: unknown): PaySettings | null; export function parseOutflowContainer(value: unknown): unknown[] | null; export function parseOutflow(value: unknown, seenIds: ReadonlySet<string>): ...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + RouteState 계약 정의 (files: src/lib/types.ts, src/types/nav.ts)
- 0002: 테스트 환경 + BASE 픽스처 + 전역 셋업 (files: package.json, vitest.config.ts, src/test/setup.ts, src/test/fixtures.ts, src/test/fixtures.test.ts)
- 0003: 날짜·금액 포맷 유틸 (getToday, localDate, format) (files: src/lib/date/getToday.ts, src/lib/date/localDate.ts, src/lib/format.ts, src/lib/date/localDate.test.ts, src/lib/format.test.ts)
- 0004: 저장소 어댑터 + save 계열 + probeStorage + id 생성 (files: src/lib/store/storage.ts, src/lib/store/keys.ts, src/lib/store/id.ts, src/lib/store/save.ts, src/lib/store/save.test.ts)
- 0005: 읽을 때 검증기 + load 계열 (손상 복구·버전 불일치·30개 상한) (files: src/lib/store/validate.ts, src/lib/store/validate.test.ts, src/lib/store/load.ts, src/lib/store/load.test.ts)
- 0006: 잔고 계산 엔진 코어 (날짜 보정·월 이벤트·투영·월 요약) (files: src/lib/balance/resolveActualDate.ts, src/lib/balance/events.ts, src/lib/balance/projection.ts, src/lib/balance/summary.ts, src/lib/balance/projection.test.ts)
- 0007: 출금일 변경 적용 시점 (applyDayChange, applyDayChangeToItem) (files: src/lib/balance/dayChange.ts, src/lib/balance/dayChange.test.ts)
- 0008: 출금일 이동 시뮬레이션 + 홈 화면 모델 selector (files: src/lib/balance/simulate.ts, src/lib/balance/simulate.test.ts, src/lib/balance/homeModel.ts, src/lib/balance/homeModel.test.ts)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/lib/analytics.ts
export type LogFields = Record<string, string | number | boolean | null>;
export const DWELL_MS = 3000;
export function fireAndForget(call: () => unknown): void {
export function logScreen(page: string, extra?: LogFields): void {
export function logClick(name: string, extra?: LogFields): void {
export function logImpression(name: string, extra?: LogFields): void {
export function useScreenLog(page: string): void {

// src/lib/balance/dayChange.ts
export function applyDayChange(
export function applyDayChangeToItem(item: Outflow, newDay: number, today: LocalDate): Outflow {

// src/lib/balance/events.ts
export interface DayOverride {
export function collectEvents(args: {
export function buildMonthEvents(args: EventArgs): DayEvent[] {

// src/lib/balance/homeModel.ts
export interface HomeCell {
export interface HomeRow {
export interface HomeS

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(14), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 진입점 라우터 배선은 맨 끝에 두지 말고 기반 패킷 직후 플레이스홀더 페이지와 함께 먼저 병합하라. 화면 패킷은 그 플레이스홀더를 교체하게 해서, 언제 중단돼도 병합된 화면에 도달할 수 있게 하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)