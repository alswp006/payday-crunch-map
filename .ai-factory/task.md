# TASK — 텅장달력 / Payday Crunch Map

> **이번 수정 (교차 검증 갭 9건 반영)**
> - **SPEC과 다르던 부분 3건을 SPEC에 맞췄습니다.**
>   - 2.5: 저장소 접근을 템플릿 localStorage helper로만 하도록 바꿨습니다. 1차 작업으로 helper 적합성을 확인하는 단계를 넣었습니다.
>   - 3.10: sim-row 보조 텍스트를 F6-AC-2 문자열과 정확히 같게 바꿨습니다.
>   - 2.2/2.9: `buildMonthEvents`가 잔고 기준일 이전·당일 이벤트를 포함한다는 해석을 DoD로 고정했습니다.
> - **순서·환경 문제 2건을 고쳤습니다.**
>   - `src/lib/nav/tabs.ts`를 4.1에서 2.1로 옮기고, 3.6과 3.12에 2.1 의존을 명시했습니다.
>   - 1.2에 RTL·jsdom 설치(`package.json`)를 추가했습니다.
> - **TASK에서만 정했던 동작 2건(기준일 62일 초과 시 일정 목록의 잔고 생략, 지난 칸 탭 불가)**: 구현은 유지하되 SPEC 반영 요청(U-4, U-5)으로 올렸습니다. 해당 DoD에는 `[U-x]` 태그를 붙였습니다.
> - **PRD·SPEC 쪽 문제와 목표 리스크 4건**: TASK로는 고칠 수 없어 맨 아래 **Upstream 변경 요청**(U-1·U-2·U-7·U-8)에 정리했습니다. 대신 TASK 쪽에서 줄일 수 있는 부분은 반영했습니다. 주말 처리 기본값을 상수 하나(`DEFAULT_WEEKEND_RULE`)로 모아, OQ-1이 해결되면 한 줄만 바꾸면 되게 했습니다.
>
> **범위 메모**
> - SPEC에는 외부 API가 없습니다(모든 기능이 "없음(localStorage)"). 그래서 템플릿의 'API Routes' Epic은 해당 없음으로 두고, 순서(타입 → 데이터 계층 → 페이지 → 통합)대로 Epic을 나눴습니다.
> - Toss 로그인, TDS 설정, AdSlot·TossRewardAd·TossPurchase 래퍼, 템플릿 localStorage helper는 이미 있으므로 태스크로 만들지 않습니다. 수정하지 않고 사용만 합니다.
> - 모든 테스트는 `getToday()`를 mock하고 BASE 픽스처(Task 1.2)를 씁니다.

---

## Epic 1. 타입 & 테스트 기반

**Risk**
- Complexity: Low
- Risk factors:
  - 저장 타입과 SPEC 픽스처가 어긋날 수 있습니다.
  - RouteState가 없으면 페이지끼리 state 모양이 달라질 수 있습니다.
  - 테스트 라이브러리가 설치되지 않으면 UI 태스크(3.x)의 DoD를 실행할 수 없습니다.
- Mitigation:
  - 타입을 첫 태스크로 고정합니다.
  - BASE 픽스처를 타입으로 선언해 필드가 빠지거나 남으면 `tsc`가 실패하게 합니다.
  - RTL·jsdom 설치와 렌더링 스모크 테스트를 1.2 DoD에 넣습니다.

### Task 1.1 도메인 타입 + RouteState
- Description: SPEC Data Models의 모든 타입과 RouteState를 런타임 코드 없이 정의합니다.
  - 정의할 타입
    - `WeekendRule`, `LocalDate`, `YearMonth`
    - `PaySettings`, `OutflowStore`, `Outflow`, `AppMeta`
    - `DayEvent`, `DayBalance`, `MonthSummary`, `SimResult`
    - `SaveResult = { ok: true } | { ok: false; error: 'quota' | 'unknown' }`
    - `LoadSettingsResult = { settings: PaySettings | null; recovered: boolean }`
    - `LoadOutflowsResult = { items: Outflow[]; recovered: boolean }`
  - `src/types/nav.ts`(SPEC이 정한 위치)
    ```ts
    export type SetupLocationState = { mode: 'onboarding' | 'edit'; focus?: 'balance' };
    export type ItemsLocationState = { from?: 'onboarding'; openAdd?: boolean };
    ```
  - `src/lib/types.ts`: 위 두 타입을 import해 RouteState를 정의합니다.
    ```ts
    export type RouteState = {
      '/': null;
      '/setup': SetupLocationState | null;
      '/items': ItemsLocationState | null;
    };
    ```
  - 파일 상단 주석에 수신 측 필수 패턴을 적습니다.
    ```ts
    // const state = parseSetupState(useLocation().state); // null-safe 파서(Task 2.1)
    // if (!state) { /* 안전 기본값으로 렌더 */ }
    // 금지: const { mode } = useLocation().state as X;
    ```
- DoD:
  - `npx tsc --noEmit`가 통과한다.
  - 두 파일의 런타임 export(`function`·`const`)가 0개이고 type/interface만 있다.
  - `Outflow.dayChange`가 optional(`?:`)이다.
  - `PaySettings`에 `updatedAt`이 없고, `Outflow`에 `createdAt`이 없다.
  - `PaySettings`·`OutflowStore`·`AppMeta`의 `version`이 리터럴 타입 `1`이다.
  - RouteState의 `/setup`·`/items` 값 타입에 `| null`이 들어 있다.
- Covers: [기반 — 직접 검증하는 AC 없음. F1~F7 전체의 타입 계약]
- Files: `src/lib/types.ts`, `src/types/nav.ts`
- Depends on: none

### Task 1.2 테스트 환경 설치 + BASE 픽스처 + 공통 셋업
- Description: 테스트 실행 환경을 갖추고, BASE 픽스처와 전역 셋업을 만듭니다.
  - **devDependencies 설치**(템플릿에 없을 때만 추가하고, 이미 있으면 버전을 바꾸지 않습니다)
    - `vitest`, `jsdom`
    - `@testing-library/react`(템플릿 React 메이저 버전과 호환되는 버전), `@testing-library/user-event`, `@testing-library/jest-dom`
  - `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['src/test/setup.ts']`, `globals: true`
  - 픽스처 상수
    - `BASE_SETTINGS: PaySettings`
    - `BASE_OUTFLOWS: Outflow[]`: `o-rent`, `o-card`, `o-phone`, `o-netflix` 순서. 모두 `weekendRule: 'none'`
    - `BASE_TODAY = '2026-10-11'`
  - 헬퍼
    - `seedBase()`: SPEC 저장 형태 그대로 localStorage에 넣습니다(`pcm.outflows.v1 = { version: 1, items }`).
    - `mockToday(d)`: `getToday` 모듈을 mock합니다.
  - 전역 셋업(`src/test/setup.ts`)
    - `import '@testing-library/jest-dom/vitest'`
    - 테스트마다 `localStorage.clear()`와 RTL `cleanup()`을 실행합니다.
    - `console.error` spy를 걸고, 호출되면 그 테스트를 실패시킵니다.
- DoD:
  - `package.json` devDependencies에 위 5개 패키지가 있고, `npm install`이 오류 없이 끝난다.
  - `npx vitest run src/test`가 exit 0이다.
  - RTL 스모크 테스트: `render(<button>확인</button>)` 후 `screen.getByRole('button', { name: '확인' })`가 `toBeInTheDocument()`를 통과한다.
  - 픽스처 파일이 `tsc`를 통과한다. 필드를 하나 빼거나 더하면 실패한다.
  - `seedBase()` 후 `JSON.parse(localStorage['pcm.outflows.v1'])`가 `{ version: 1, items: BASE_OUTFLOWS }`와 deep-equal이다.
  - `console.error('x')`를 호출하는 샘플 테스트를 `it.fails`로 두었을 때 통과한다(셋업이 실패를 잡는다는 뜻).
- Covers: [기반 — F1~F7 테스트 공통 픽스처, RTL 환경, console.error 검증]
- Files: `package.json`, `package-lock.json`, `vitest.config.ts`, `src/test/fixtures.ts`, `src/test/setup.ts`, `src/test/setup.test.tsx`
- Depends on: Task 1.1

---

## Epic 2. 데이터 계층 (순수 함수 → 저장소 → 상태)

**Risk**
- Complexity: High. 날짜 보정, 달 경계, 같은 날 출금 우선, dayChange 적용 시점, 읽을 때 검증이 모두 여기에 있습니다.
- Risk factors:
  - `toISOString()`을 쓰면 UTC 변환 때문에 날짜가 하루 밀립니다.
  - 주말 보정이 달 경계를 넘으면 이벤트가 빠질 수 있습니다.
  - `{...item, ...r}` 병합으로 기존 `dayChange`가 남을 수 있습니다.
  - 템플릿 localStorage helper가 예외를 삼키거나, 키에 접두사를 붙이거나, 자동으로 JSON 직렬화를 하면 SPEC의 quota 구분과 저장 형태 AC를 만족할 수 없습니다.
  - 저장이 실패했는데 화면 상태가 먼저 바뀌면 저장값과 어긋납니다.
- Mitigation:
  - 날짜 유틸(2.1)을 가장 먼저 두고, 모든 엔진이 이것만 쓰게 합니다.
  - 이벤트는 대상 달의 앞뒤 1개월까지 만든 뒤 필터합니다.
  - `applyDayChangeToItem`이 객체를 필드별로 새로 만들고, F1-AC-13 테스트로 고정합니다.
  - 2.5 첫 단계에서 helper 적합성을 테스트로 판정합니다. 부적합하면 구현을 멈추고 U-6으로 올립니다.
  - Provider(2.10)는 save 결과가 `ok`일 때만 state를 바꿉니다.

### Task 2.1 날짜·금액·내비 유틸 + 탭 설정 + 기본값 상수
- Description: 모든 계층이 공유하는 순수 유틸과 상수를 만듭니다.
  - `getToday(): LocalDate`: 오늘 날짜는 이 함수에서만 얻습니다.
  - 날짜 유틸(`localDate.ts`)
    - `toLocalDate(y, m, d)`, `parseLocalDate`, `addDays`, `diffDays`, `monthOf`, `addMonths(ym, n)`, `daysInMonth`
    - `weekday`: `new Date(y, m-1, d).getDay()`로 구합니다.
    - `formatMonthDayKo`: "10월 24일 (토)" 형식
    - `isValidLocalDate`(정규식 + 실재 날짜), `isValidYearMonth`
  - 금액 유틸(`money.ts`): `formatWon`(콤마), `formatCompactWon`(SPEC 규칙), `digitsOnly(str)`
  - 내비 state 파서(`navState.ts`): `parseSetupState(raw: unknown): SetupLocationState | null`, `parseItemsState(raw: unknown): ItemsLocationState | null`
  - **탭 설정(`tabs.ts`, 4.1에서 이동)**
    - `export const APP_TABS`: '달력' `/`, '출금 항목' `/items` 두 개를 템플릿 `FloatingTabBar`가 받는 항목 형태 그대로 정의합니다.
    - Home(3.12)과 Items(3.6)는 이 상수만 import합니다. 탭 배열을 각자 정의하지 않습니다.
  - **기본값 상수(`defaults.ts`)**
    - `export const DEFAULT_WEEKEND_RULE: WeekendRule = 'none'`
    - 근거 미확정(OQ-1)이라는 주석을 답니다. 설정 화면(3.3)과 출금 시트(3.5)의 초기값은 이 상수만 씁니다.
  - id 생성(`id.ts`): `newId()` = `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- DoD:
  - 아래 단위 테스트가 통과한다.
  - `formatCompactWon` 결과
    - `9800` → `'9,800'`
    - `380000` → `'38만'`
    - `-252000` → `'-25.2만'`
    - `2248000` → `'224.8만'`
    - `1196000` → `'119.6만'`
    - `123000000` → `'1.2억'`
  - `isValidLocalDate('2026-02-30')`와 `isValidLocalDate('2026/10/11')`는 false다.
  - `isValidYearMonth('2026-13')`은 false다.
  - `formatMonthDayKo('2026-10-24')`는 `'10월 24일 (토)'`다.
  - `diffDays('2026-10-11', '2026-12-13')`은 `63`이다.
  - `parseSetupState(undefined)`, `parseSetupState(null)`, `parseSetupState({ mode: 'x' })`는 모두 `null`이다.
  - `APP_TABS`는 2개 항목이고, 경로가 순서대로 `'/'`, `'/items'`, 라벨이 `'달력'`, `'출금 항목'`이다.
  - `DEFAULT_WEEKEND_RULE === 'none'`이다.
  - `newId()`는 길이 1~32의 문자열이다.
  - 다음 문자열이 이 태스크 파일들에서 0건이다(grep): `toISOString`, `crypto.randomUUID`, `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter`
- Covers: [F7-AC-7(호환 API 미사용, 부분), F4-AC-2(formatCompactWon 표기, 부분)]
- Files: `src/lib/date/getToday.ts`, `src/lib/date/localDate.ts`, `src/lib/date/localDate.test.ts`, `src/lib/format/money.ts`, `src/lib/format/money.test.ts`, `src/lib/nav/navState.ts`, `src/lib/nav/tabs.ts`, `src/lib/nav/navState.test.ts`, `src/lib/defaults.ts`, `src/lib/store/id.ts`
- Depends on: Task 1.1

### Task 2.2 날짜 보정 + 월 이벤트 목록
- Description: 실제 처리 날짜 보정과 달별 이벤트 목록을 만듭니다.
  - `resolveActualDate(year, month, day, rule)`
    - 먼저 day를 그 달 말일로 보정합니다.
    - 그다음 토·일이면 rule에 따라 직전 또는 다음 평일로 옮깁니다. 달 경계를 넘을 수 있습니다.
  - 내부 함수 `eventsForMonth(settings, outflows, ym): DayEvent[]`
    - dayChange가 있으면 `ym >= effectiveMonth`인 달은 `day`, 그 전 달은 `fromDay`를 씁니다.
    - `shifted`는 actualDate가 보정 전 날짜와 다르면 true입니다.
  - `buildMonthEvents({ settings, outflows, month })`
    - month−1부터 month+1까지 `eventsForMonth`를 호출하고, actualDate가 그 달에 드는 이벤트만 남깁니다.
    - **balanceAsOf와 비교해 걸러 내지 않습니다.** 기준일 이전·당일 이벤트도 모두 포함합니다. 이는 F4-AC-3·F4-AC-10의 해석이며, SPEC 문장 수정 요청은 U-3입니다.
    - 잔고 숫자를 표시할지는 이 함수가 아니라 2.9의 `showBalance`가 정합니다.
    - 정렬은 날짜 오름차순입니다. 같은 날이면 출금이 먼저이고, 출금끼리는 `outflows` 배열 순서를 따릅니다.
- DoD:
  - `resolveActualDate` 단위 테스트
    - `(2026,10,25,'prevBusinessDay')` → `'2026-10-23'`
    - `(2026,10,24,'nextBusinessDay')` → `'2026-10-26'`
    - `(2026,11,31,'none')` → `'2026-11-30'`
    - `(2027,2,31,'none')` → `'2027-02-28'`
  - BASE에서 월세를 `nextBusinessDay`로 바꾸면, `buildMonthEvents('2026-10')`의 월세 이벤트가 `{ refId: 'o-rent', shifted: true, actualDate: '2026-10-26' }`를 포함한다.
  - **기준일 이전**: BASE에 관리비(`o-mgmt`, day 5)를 더하면 `buildMonthEvents('2026-10')`의 첫 원소가 관리비이고 `actualDate`는 `'2026-10-05'`다.
  - **기준일 당일**: BASE에 `{ id: 'o-gym', name: '헬스장', amount: 50000, day: 11, weekendRule: 'none' }`을 더하면 `buildMonthEvents('2026-10')`에 `actualDate: '2026-10-11'`인 헬스장 이벤트가 있다. 이벤트 개수는 6개(BASE 5 + 1)다.
  - 같은 날 출금과 월급이 있으면 출금이 먼저 온다(F1-AC-3 픽스처의 10-25).
- Covers: [F1-AC-2(보정 부분), F4-AC-3(행 목록 원천), F4-AC-10(이벤트 목록 부분)]
- Files: `src/lib/balance/resolveActualDate.ts`, `src/lib/balance/events.ts`, `src/lib/balance/events.test.ts`
- Depends on: Task 2.1

### Task 2.3 잔고 투영 + 월 요약
- Description: 날짜별 예상 잔고 투영과 월 요약을 만듭니다.
  - `buildProjection({ settings, outflows, today, endDate, override? })`
    - balanceAsOf 당일은 이벤트 없이 `low = end = currentBalance`입니다.
    - actualDate가 (asOf, endDate]인 이벤트만 반영합니다.
    - 같은 날에는 출금 합을 먼저 빼서 `lowBalance`를 만들고, 그다음 월급을 더해 `endBalance`를 만듭니다.
    - `override`가 있으면 해당 itemId의 day를 toDay로 바꾸고 dayChange는 무시합니다.
  - `summarizeMonth(days, month, today)`
    - 판단 범위: 이번 달이면 max(today, asOf, 월초)부터 월말까지, 다른 달이면 월 전체입니다.
    - `lowest`는 lowBalance 최소이고, 동률이면 가장 이른 날입니다.
    - `crunch`는 lowest.date부터 다음 월급 actualDate 전날까지이며, 월말을 넘으면 월말에서 자릅니다. lowest.date에 월급이 있으면 그 하루입니다.
    - `firstNegativeDate`를 구합니다.
  - 홈은 다음 달 말일까지 투영합니다.
- DoD:
  - F1-AC-1: endBalance가 10-14 380,000 / 10-18 363,000 / 10-21 298,000 / 10-24 -252,000 / 10-25 2,248,000 / 11-24 1,196,000 / 11-25 3,696,000이다.
    - 요약은 `lowest = { date: '2026-10-24', balance: -252000 }`, `crunch = { start: '2026-10-24', end: '2026-10-24', days: 1 }`, `firstNegativeDate = '2026-10-24'`다.
  - F1-AC-2 후반: 월급을 prev, 월세를 next로 바꾸면 `lowest = { date: '2026-10-21', balance: 298000 }`, `crunch = { start: '2026-10-21', end: '2026-10-22', days: 2 }`, `firstNegativeDate = null`이다.
  - F1-AC-3: 10-25의 `lowBalance = -200000`, `endBalance = 2300000`이고, lowest·crunch가 SPEC 값과 같다.
  - F1-AC-8: 출금이 0개면 `lowest = { date: '2026-10-11', balance: 800000 }`, `crunch = { start: '2026-10-11', end: '2026-10-24', days: 14 }`, 10-25 endBalance는 3,300,000이며 예외가 없다.
  - 기준일 당일 이벤트: 2.2의 헬스장(day 11)을 더해도 10-11 endBalance는 800,000이다(당일 이벤트는 반영하지 않음).
- Covers: [F1-AC-1, F1-AC-2, F1-AC-3, F1-AC-8]
- Files: `src/lib/balance/projection.ts`, `src/lib/balance/summary.ts`, `src/lib/balance/projection.test.ts`
- Depends on: Task 2.2

### Task 2.4 출금일 변경 적용 시점
- Description: 출금일 변경을 언제부터 적용할지 정하는 순수 함수 2개를 만듭니다.
  - `applyDayChange(item, newDay, today)`
    - SPEC의 curDay 규칙과 비교 규칙을 따릅니다.
    - 날짜 비교는 `resolveActualDate(…, 'none')`로 합니다.
  - `applyDayChangeToItem(item, newDay, today): Outflow`
    - 결과 객체를 `{ id, name, amount, weekendRule, day }`로 필드별로 새로 만듭니다.
    - `r.dayChange`가 있을 때만 `dayChange` 키를 추가합니다.
    - spread 병합은 쓰지 않습니다.
- DoD:
  - F1-AC-5: 세 호출의 반환값이 SPEC과 같고, 셋째는 `'dayChange' in r === false`다.
    - 첫째 결과로 asOf 10-11부터 투영하면 10월에는 카드값 이벤트가 없고 11-26에 있다.
    - 기존 dayChange가 있는 카드값에 27을 넣으면 `{ day: 27, dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`다.
  - F1-AC-13: 두 경우의 결과 키가 정확히 `id`, `name`, `amount`, `weekendRule`, `day` 5개다.
    - `saveOutflows` 후 저장 문자열에 `"dayChange"`가 없다.
    - `(카드값, 26, '2026-10-11')`이면 dayChange가 유지된다.
  - `dayChange.ts`에서 `...item` 문자열이 0건이다(grep).
- Covers: [F1-AC-5, F1-AC-13]
- Files: `src/lib/balance/dayChange.ts`, `src/lib/balance/dayChange.test.ts`
- Depends on: Task 2.3, Task 2.5

### Task 2.5 저장소 어댑터(템플릿 helper 경유) + save 계열 + probeStorage
- Description: SPEC Common Principles("템플릿 localStorage helper를 거쳐 키 3개를 쓴다")대로, 저장소 접근을 어댑터 한 모듈에 모읍니다. 이 모듈은 템플릿 helper만 호출합니다.
  - **1단계: helper 적합성 판정 테스트(`storage.helper.test.ts`)**
    - 템플릿 helper의 실제 export(경로·함수명은 템플릿 그대로 사용)로 아래 세 가지를 확인합니다.
      - (a) 키 보존: helper로 `'pcm.settings.v1'`에 쓰면 `window.localStorage.getItem('pcm.settings.v1')`로 같은 키에서 읽힌다(접두사가 붙지 않음).
      - (b) 원문 보존: 문자열을 쓰면 저장 원문이 그 문자열과 같다. helper가 JSON 직렬화를 강제하면, 객체를 넘겼을 때의 저장 원문이 `JSON.stringify(obj)`와 같다.
      - (c) 예외 전파: `Storage.prototype.setItem`·`getItem`이 예외를 던지도록 mock하면 helper 호출도 예외를 던진다(삼키지 않음).
    - 세 가지가 모두 통과하면 2단계로 갑니다.
    - 하나라도 실패하면 이 태스크를 **차단 상태로 종료**합니다. 실패 항목과 helper 소스 위치를 U-6에 기록하고, SPEC Common Principles 수정을 요청합니다. 이 경우 helper를 수정하거나 `window.localStorage`로 우회하지 않습니다.
  - **2단계: 어댑터(`storage.ts`)**
    - `readRaw(key): string | null`, `writeRaw(key, value): void`, `removeKey(key): void`
    - 셋 다 템플릿 helper만 호출하고, 예외를 그대로 던집니다. 예외 처리는 save·load 계열이 합니다.
    - 앱 코드에서 저장소에 접근하는 곳은 이 파일 하나뿐입니다.
  - 키 상수: `pcm.settings.v1`, `pcm.outflows.v1`, `pcm.meta.v1`
  - `probeStorage()`: `readRaw('pcm.settings.v1')`를 try/catch로 실행합니다. 쓰기는 시도하지 않습니다.
  - `saveSettings` / `saveOutflows` / `saveMeta`
    - 타입에 정의된 필드만 직렬화합니다. outflows는 `{ version: 1, items }`로 감쌉니다.
    - `SaveResult`를 돌려주고 예외를 던지지 않습니다.
  - `classifyStorageError(e)`
    - name이 `QuotaExceededError` 또는 `NS_ERROR_DOM_QUOTA_REACHED`이거나 code가 22 또는 1014면 `'quota'`입니다.
    - 그 밖은 `'unknown'`입니다.
- DoD:
  - helper 적합성 테스트 (a)(b)(c)가 모두 통과한다. 하나라도 실패하면 이 태스크는 미완료이고 U-6에 기록된다.
  - `src/lib/store/storage.ts`를 뺀 앱 소스(테스트 제외)에서 `localStorage` 문자열이 0건이다(grep, 4.3에서도 검사).
  - F1-AC-7: `setItem`이 QuotaExceededError를 던지면 `{ ok: false, error: 'quota' }`이고 기존 `pcm.outflows.v1` 값이 그대로다.
  - F1-AC-9: `SecurityError` 또는 `new Error('x')`를 던지면 세 save 모두 `{ ok: false, error: 'unknown' }`이고 기존 세 키가 그대로다.
    - `name: 'NS_ERROR_DOM_QUOTA_REACHED'`나 `code: 22`면 `'quota'`다.
  - F1-AC-10(probe): `window.localStorage` getter나 `getItem`이 예외를 던지면 `probeStorage()`는 false이고, mock을 풀면 true다.
  - `saveSettings({ ...BASE_SETTINGS, extra: 1 } as any)` 후 저장된 객체의 키가 6개다.
  - 모든 케이스에서 console.error는 0회다.
- Covers: [F1-AC-7, F1-AC-9, F1-AC-10(probe 부분), Common Principles '템플릿 localStorage helper 경유']
- Files: `src/lib/store/storage.ts`, `src/lib/store/storage.helper.test.ts`, `src/lib/store/keys.ts`, `src/lib/store/save.ts`, `src/lib/store/save.test.ts`
- Depends on: Task 1.2

### Task 2.6 읽을 때 검증기 (순수 함수)
- Description: 저장소에 접근하지 않는 정규화·검증 함수를 만듭니다.
  - `isPlainObject`, `isIntInRange`
  - `normalizeSettings(v: unknown): PaySettings | null`: 표의 조건을 모두 통과하면 6개 키만 가진 새 객체를 돌려줍니다.
  - `normalizeOutflowItem(v, seenIds): Outflow | null`
    - id 중복은 `seenIds`로 확인합니다.
    - name은 trim 후 1~20자여야 합니다.
    - dayChange는 키가 없거나 유효해야 합니다.
    - 결과 객체에는 정의된 키만 넣습니다.
  - `normalizeMeta(v): AppMeta | null`
- DoD:
  - F1-AC-11의 실패 값 16개가 모두 `null`이다.
  - F1-AC-11의 경계값 4개(`salaryAmount: 1000000000`, `salaryDay: 31`, `currentBalance: 0`, `currentBalance: 9999999999`)는 통과한다.
  - `updatedAt`이 있는 설정은 통과하고, 결과에 `updatedAt` 키가 없다.
  - F1-AC-12의 항목 실패 케이스(`fromDay: 40`, `effectiveMonth: '2026-13'`, 공백 이름, 21자 이름, `weekendRule: 'weekend'`, 중복 id)가 `null`이다.
  - `createdAt`이 있는 항목은 키를 뺀 채 통과하고, `effectiveMonth: '2026-09'`인 항목도 통과한다.
  - F7-AC-6의 메타 실패 값 5개가 `null`이고, `{ version: 1, lastSeenMonth: null }`은 유효하다.
- Covers: [F1-AC-11, F1-AC-12, F7-AC-6 (판정 부분)]
- Files: `src/lib/store/validate.ts`, `src/lib/store/validate.test.ts`
- Depends on: Task 2.1

### Task 2.7 불러오기(load) 계열
- Description: SPEC의 키별 '읽을 때 검증' 규칙대로 load 함수 3개를 만듭니다. 저장소 접근은 2.5 어댑터(`readRaw`/`writeRaw`/`removeKey`)로만 합니다.
  - `loadSettings()`
    - 파싱 실패나 normalize 실패면 키를 삭제하고 `{ settings: null, recovered: true }`를 돌려줍니다.
    - 키가 없으면 `{ settings: null, recovered: false }`입니다.
  - `loadOutflows()`
    - ① 컨테이너를 검증합니다. 실패하면(버전 없는 배열 포함) 키를 삭제합니다.
    - ② 항목별로 걸러 냅니다.
    - ③ 30개를 넘으면 앞에서부터 30개만 남깁니다.
    - 걸러 낸 것이 있으면 `{ version: 1, items }`로 다시 저장합니다. 다시 저장이 실패해도 같은 값을 돌려줍니다.
  - `loadMeta()`: 실패하면 키를 지우지 않고 `null`을 돌려줍니다.
  - 저장소 접근 자체가 예외를 던지면 '키 없음'과 같은 값을 돌려주고, remove·write를 호출하지 않습니다.
- DoD:
  - F1-AC-4: save 후 load 왕복 결과가 deep-equal이고, 순서가 유지되며, `dayChange` 키가 없다.
  - F1-AC-6
    - settings가 `'{bad'` 또는 `'{"version":1,"salaryDay":"x"}'`이면 `{ settings: null, recovered: true }`를 돌려주고 키를 삭제한다.
    - outflows가 `'{bad'`, `'{"a":1}'`, `'[]'`, 버전 없는 BASE 배열이면 `{ items: [], recovered: true }`를 돌려주고 키를 삭제한다.
    - 넷플릭스만 `amount: -5`이면 3개를 남기고 다시 저장하며, 다음 호출은 `recovered: false`다.
  - F1-AC-10: 접근이 막히면 load 3종이 기본값을 돌려주고, `removeItem`·`setItem` 호출이 0회다.
  - F1-AC-11: 실패 값 16개 모두 키가 삭제되고 `recovered: true`다.
    - 경계값은 `recovered: false`다.
    - `updatedAt`이 있으면 원문 문자열이 바뀌지 않는다.
  - F1-AC-12
    - 9개 케이스의 결과가 SPEC과 같다.
    - 다시 저장한 뒤의 다음 호출은 `recovered: false`다.
    - 다시 저장 중 quota면 같은 items와 `recovered: true`를 돌려주고, 원문이 바뀌지 않는다.
    - `createdAt`만 있으면 키를 다시 쓰지 않는다(`setItem` 0회).
  - F7-AC-6(load): 메타가 손상되면 `null`을 돌려주고 키는 남아 있다.
  - `load.ts`에 `localStorage` 문자열이 0건이다(grep).
  - 모든 케이스에서 console.error는 0회다.
- Covers: [F1-AC-4, F1-AC-6, F1-AC-10, F1-AC-11, F1-AC-12, F7-AC-6(load 부분)]
- Files: `src/lib/store/load.ts`, `src/lib/store/load.test.ts`
- Depends on: Task 2.5, Task 2.6

### Task 2.8 출금일 이동 시뮬레이션 엔진
- Description: 항목별로 출금일을 옮겼을 때의 최저 잔고 변화를 계산합니다.
  - `simulateShift(settings, outflows, itemId, toDay, today): SimResult`
    - 구간: today부터 다음 달 말일까지의 lowBalance 최솟값입니다.
    - 이번 달 적용 규칙: 이번 달의 원래 actualDate와 새 actualDate를 항목 weekendRule로 구합니다.
      - 둘 다 today보다 뒤면 이번 달부터 새 날짜를 씁니다.
      - 그렇지 않으면 대상 항목을 `{ day: toDay, dayChange: { fromDay: curDay, effectiveMonth: 다음 달 } }`로 바꾼 outflows 사본으로 투영합니다.
    - 기존 dayChange가 아직 적용 전이면 curDay = fromDay입니다.
  - `bestShifts(settings, outflows, today): SimResult[]`
    - 후보는 1~28일(원래 날짜 제외)입니다.
    - 동률이면 원래 날짜와의 차가 작은 날, 그다음 이른 날을 고릅니다.
    - delta ≤ 0이면 `toDay = fromDay, delta = 0, improved = false`입니다.
    - 정렬은 delta 내림차순, 같으면 이름 순(`localeCompare`)입니다.
- DoD:
  - F6-AC-3
    - 월세 결과가 `{ itemId: 'o-rent', fromDay: 24, toDay: 26, baseMin: -252000, newMin: 298000, delta: 550000, improved: true }`다.
    - `simulateShift(…, 'o-rent', 25, …)`의 newMin은 -252,000이다.
    - 카드값 결과가 `{ itemId: 'o-card', toDay: 26, newMin: 168000, delta: 420000 }`를 포함한다.
    - 결과 순서는 월세 → 카드값 → 통신비 → 넷플릭스다.
  - F6-AC-4: `simulateShift(…, 'o-rent', 5, '2026-10-11')`이면 10월 월세는 10-24에, 11월 월세는 11-05에 있고, `{ baseMin: -252000, newMin: -252000, delta: 0, improved: false }`다.
  - F6-AC-6: 월세가 day 26인 항목 하나뿐이면 `{ toDay: 26, delta: 0, improved: false }`다.
  - F6-AC-10: `simulateShift(…, 'o-rent', 31, …)`은 10-31과 11-30에 반영되고 `{ baseMin: -252000, newMin: 298000, delta: 550000, improved: true }`다.
  - 출금 30개로 `bestShifts`를 실행하면 테스트 환경에서 500ms 안에 끝난다.
- Covers: [F6-AC-3, F6-AC-4, F6-AC-6(엔진 부분), F6-AC-10(엔진 부분)]
- Files: `src/lib/balance/simulate.ts`, `src/lib/balance/simulate.test.ts`
- Depends on: Task 2.3

### Task 2.9 홈 화면 모델 selector (순수 함수)
- Description: `buildHomeModel({ settings, outflows, today, month })`가 홈 렌더에 필요한 값을 한 번에 계산합니다. UI는 계산하지 않고 그리기만 합니다.
  - 공통 값
    - `endDate`: today 기준 다음 달 말일
    - `days`: `buildProjection` 결과
    - `summary`: `summarizeMonth` 결과
    - `events`: `buildMonthEvents(month)` 결과. 셀 이름과 행 목록의 유일한 원천이며, 기준일 이전·당일 이벤트를 포함합니다.
  - `balanceHidden`: `diffDays(asOf, today) > 62`
  - `isStaleMonth`: `monthOf(asOf) !== monthOf(today)`
  - `leadingBlanks`: 그 달 1일의 요일
  - `cells[]`: 그 달 날짜마다 다음 값을 가집니다.
    - `date`
    - `names`(`events`에서 그날 첫 이름), `moreCount`
    - `showBalance = !balanceHidden && date >= today && date > asOf`
      - `date > asOf` 조건은 기준일 이전·당일 날짜의 잔고 숫자를 숨깁니다. SPEC "actualDate > balanceAsOf인 날만 잔고 표시"와 같습니다.
      - today = asOf일 때 asOf 당일 칸도 잔고를 숨기면 F4-AC-2("10-11부터 칸마다 표시")와 어긋납니다. 그래서 실제 조건은 `date >= today && (date > asOf || date === today)`로 정합니다. DoD로 고정합니다.
    - `endBalance`, `lowBalance`, `dayEvents`
    - `isPast`(date < today), `isNegative`, `inCrunch`, `isLowest`
    - `tappable = showBalance` **[U-5, SPEC 반영 대기]**
  - `rows[]`: `events` 원소마다 1행입니다. `label`은 "10월 14일 (수) 카드값" 형식이고, `sub`는 아래 규칙을 따릅니다(F4-AC-3).
    - actualDate ≤ asOf: `-{금액}원 · 지남`
    - asOf < actualDate < today: `-{금액}원 · 잔고 {end}원 · 지남`
    - 그 외: `±{금액}원 · 잔고 {end}원`
    - shifted면 `주말이라 {M}월 {D}일({요일})로`를 덧붙입니다.
    - balanceHidden이면 `· 잔고 {end}원` 구간을 생략합니다. 행 자체는 유지합니다. **[U-4, SPEC 반영 대기]**
  - `sparkline`: summarizeMonth 판단 범위의 endBalance 배열과 최저점 인덱스
- DoD:
  - F4-AC-3: BASE 10월 rows 5개의 label·sub 문자열이 SPEC과 정확히 같다.
  - F4-AC-2: today = asOf = `'2026-10-11'`이면 10-11 셀 `showBalance` true(endBalance 800,000), 10-10 셀 false다.
  - F4-AC-10
    - 관리비(day 5)를 더하면 rows가 6개이고 첫 행 sub는 `-100,000원 · 지남`이다.
    - 10-05 셀은 `names[0] === '관리비'`, `showBalance` false다. 10-14 셀 endBalance는 380,000이다.
    - 11월 rows에 `11월 5일 (목) 관리비` / `-100,000원 · 잔고 2,148,000원`이 있다.
  - 기준일 당일 이벤트: 헬스장(day 11)을 더하면 10월 rows에 `10월 11일 (일) 헬스장` / `-50,000원 · 지남`이 있다.
  - F4-AC-7: month `'2026-11'`이면 leadingBlanks 0, cells 30개, 11-24 셀 endBalance 1,196,000이다.
  - F7-AC-2: today `'2026-11-02'`이면 11-02 셀 endBalance 2,248,000(`showBalance` true), 11-01 셀 `showBalance` false, `summary.lowest = { date: '2026-11-24', balance: 1196000 }`이다.
  - F7-AC-5: today `'2026-12-13'`이면 `balanceHidden` true이고 `showBalance`가 true인 셀이 0개다. `'2026-12-12'`이면 false다.
  - [U-4] today `'2026-12-13'`이면 rows 개수는 balanceHidden이 아닐 때와 같고, 모든 `sub`에 `잔고`가 들어 있지 않다.
  - [U-5] 모든 셀에서 `tappable === showBalance`다.
  - F5-AC-2: F1-AC-2 변형 설정이면 10-21·10-22 셀이 `inCrunch` true, 10-21 셀이 `isLowest` true다.
  - F5-AC-4: BASE 10월 sparkline 점이 21개이고 최저점 인덱스가 10-24 위치다.
- Covers: [F4-AC-2(잔고 표시 범위), F4-AC-3, F4-AC-7, F4-AC-10, F7-AC-2, F7-AC-5, F5-AC-2, F5-AC-4 (계산 부분), U-4·U-5(제안)]
- Files: `src/lib/balance/homeModel.ts`, `src/lib/balance/homeModel.test.ts`
- Depends on: Task 2.3

### Task 2.10 앱 데이터 상태 (Context Provider)
- Description: 앱 전체가 쓰는 데이터 상태를 Context로 둡니다.
  - 마운트할 때 한 번 동기로 읽습니다: `today = getToday()`, `loadSettings()`, `loadOutflows()`
  - 노출하는 값
    - `today`, `settings`, `outflows`
    - `recovery: { settings: boolean; outflows: boolean }`, `consumeRecovery(kind)`
  - 노출하는 함수
    - `saveSettings(s): SaveResult`
    - `addOutflow(input): SaveResult`: 새 id를 붙여 끝에 추가
    - `replaceOutflow(id, item): SaveResult`: 같은 인덱스에서 교체
    - `removeOutflow(id): SaveResult`
  - 모든 변경은 save가 ok일 때만 React state를 바꿉니다. 실패하면 state를 그대로 두고 결과만 돌려줍니다.
  - 저장 전 폼 입력은 여기 두지 않습니다. 각 화면의 컴포넌트 state에만 둡니다(sessionStorage 금지).
- DoD:
  - renderHook 테스트가 통과한다.
  - BASE를 seed하면 outflows 순서가 월세·카드값·통신비·넷플릭스다.
  - `addOutflow`가 성공하면 끝에 추가되고, 저장 형태가 `{ version: 1, items }`다.
  - `saveOutflows`를 `{ ok: false, error: 'quota' }` 또는 `'unknown'`으로 mock하면, add·replace·remove 뒤에도 `outflows`가 이전 배열과 같고 실패 결과를 그대로 돌려준다.
  - `saveSettings`가 실패하면 `settings`가 바뀌지 않는다.
  - outflows가 손상돼 있으면 `recovery.outflows`가 true이고, `consumeRecovery('outflows')` 후 false다.
- Covers: [F2-AC-5, F2-AC-11, F3-AC-8, F3-AC-10, F4-AC-9 (상태 불변·복구 플래그 부분)]
- Files: `src/state/AppDataContext.tsx`, `src/state/AppDataContext.test.tsx`
- Depends on: Task 2.4, Task 2.7

---

## Epic 3. UI 화면 (TDS 블록 조립, 페이지를 컴포넌트 단위로 분할)

**Risk**
- Complexity: High. 홈 하나에 무료 층, 배너, 리워드 게이트, 시트 2개가 있습니다. 폼 검증 규칙도 3개 화면에 걸쳐 있습니다.
- Risk factors:
  - TDS 여백을 덮어쓰면 검수에서 반려됩니다.
  - HEX 색상 리터럴이 들어갈 수 있습니다.
  - TossRewardAd가 리렌더 때 remount되면 저장 후 잠금 층이 다시 닫힐 수 있습니다.
  - StrictMode에서 effect가 두 번 실행돼 Toast나 logImpression이 중복될 수 있습니다.
  - `location.state`가 없을 때(새로고침, 직접 진입) 크래시할 수 있습니다.
  - Home과 Items가 탭 설정을 각자 정의하면 서로 어긋납니다.
- Mitigation:
  - 홈을 컴포넌트 5개(3.7~3.11)와 진입 가드(3.13)로 나누고, 3.12는 조립만 합니다.
  - 계산은 2.9 selector에서 끝냅니다.
  - 일회성 effect는 `useRef` 가드로 1회만 실행합니다.
  - SimSection에는 동적 key를 주지 않습니다.
  - 모든 페이지가 `parseXState`(2.1)로 state를 null-safe하게 읽습니다.
  - 탭은 `APP_TABS`(2.1)만 씁니다.
  - 여백은 `Spacing`, 색은 `var(--adaptive*)`만 씁니다. 4.3에서 정적 검사합니다.

### Task 3.1 StorageGuard + 저장소 사용 불가 화면
- Description: 저장소에 접근할 수 없을 때 라우트 대신 안내 화면을 보여 줍니다.
  - `StorageGuard`
    - `useState(() => probeStorage())`로 첫 렌더 전에 1회 확인합니다.
    - true면 children을, false면 `StorageUnavailable`을 렌더합니다.
  - `StorageUnavailable`(`data-testid="storage-unavailable"`)
    - Top "텅장달력"
    - Asset.ContentIcon
    - Paragraph.Text "저장 공간을 쓸 수 없어 달력을 만들 수 없어요"
    - Paragraph.Text "토스 앱을 완전히 닫았다가 다시 열어주세요"
    - Button display="block" '다시 시도'
  - '다시 시도'를 탭하면 다시 probe합니다. 여전히 false면 Toast "아직 저장 공간을 쓸 수 없어요", true면 children을 렌더합니다.
  - 이 화면에는 FloatingTabBar, AdSlot, TossRewardAd가 없습니다.
- DoD:
  - RTL 테스트가 통과한다.
  - probe를 false로 mock하면 `storage-unavailable`과 위 문구 4개가 보이고, children 마커는 없다.
  - 재시도 시 여전히 false면 Toast "아직 저장 공간을 쓸 수 없어요"가 1회 뜬다.
  - mock을 해제하고 재시도하면 children이 렌더된다.
  - console.error는 0회다.
- Covers: [F4-AC-11(컴포넌트 부분)]
- Files: `src/components/StorageGuard.tsx`, `src/components/StorageUnavailable.tsx`, `src/components/StorageGuard.test.tsx`
- Depends on: Task 2.5

### Task 3.2 숫자 입력 필드 (공용)
- Description: TDS `TextField`를 감싼 `NumericField`를 만듭니다.
  - `inputMode="numeric"`, 접미 텍스트('원'·'일') prop
  - `digitsOnly`로 숫자 외 문자를 무시합니다('-' 포함).
  - `comma` 옵션이면 표시할 때 콤마를 넣습니다.
  - focus 시 `scrollIntoView({ block: 'center' })`를 호출합니다.
  - `onBlur`를 전달하고, `forwardRef`로 자동 포커스를 지원하며, `errorMessage`를 표시합니다.
  - 여백은 TDS 기본값을 그대로 씁니다.
- DoD:
  - RTL 테스트가 통과한다.
  - '2500000'을 입력하면 표시 값이 '2,500,000'이고, onChange 값은 '2500000'이다.
  - 'abc'나 '-'를 입력해도 값이 바뀌지 않는다.
  - focus 시 `scrollIntoView`가 `{ block: 'center' }`로 1회 호출된다.
  - input의 `inputmode` 속성이 `numeric`이다.
  - 소스에 padding·margin 인라인 스타일이 0건이다.
- Covers: [F2-AC-7, F2-AC-9('abc' 무시)]
- Files: `src/components/form/NumericField.tsx`, `src/components/form/NumericField.test.tsx`
- Depends on: Task 2.1

### Task 3.3 설정 폼 상태·검증 훅
- Description: 설정 화면의 입력 상태와 검증을 훅과 순수 함수로 만듭니다.
  - `useSetupForm(initial)`
    - 값: `salaryAmount`, `salaryDay`, `balance`(숫자 문자열), `weekendRule`(초기값 `DEFAULT_WEEKEND_RULE`)
    - `touched`, `errors`
    - `canSubmit`: 세 필드가 모두 ''가 아니면 true
    - `onBlur(field)`: 빈 값이면 아래 문구를 표시하고, 값을 다시 넣으면 지웁니다.
      - "월급 실수령액을 입력해주세요"
      - "월급일을 입력해주세요"
      - "지금 잔고를 입력해주세요"
  - `validateSetupValues(v)`: 범위 오류 문구를 돌려줍니다. 빈 값은 검증하지 않습니다.
    - 월급 0: "0원보다 큰 금액을 입력해주세요"
    - 월급 1,000,000,000 초과: "10억 원 이하로 입력해주세요"
    - 월급일 0 또는 32: "1~31 사이 날짜를 입력해주세요"
    - 잔고 9,999,999,999 초과: "잔고는 9,999,999,999원 이하로 입력해주세요"
    - 잔고 0은 통과합니다.
- DoD:
  - 단위 테스트와 renderHook 테스트가 통과한다.
  - F2-AC-3·4·9의 범위 케이스 문구가 SPEC과 정확히 같다.
  - 잔고 '0'은 오류가 없다.
  - 빈 필드가 하나라도 있으면 `canSubmit`이 false다.
  - blur 문구 3종이 나오고, 값을 다시 넣으면 사라진다.
  - 저장된 설정이 없을 때 `weekendRule` 초기값이 `DEFAULT_WEEKEND_RULE`이다. 이 파일에 `'none'` 리터럴이 0건이다(grep).
- Covers: [F2-AC-3, F2-AC-4, F2-AC-6, F2-AC-9, F2-AC-10]
- Files: `src/pages/setup/useSetupForm.ts`, `src/pages/setup/useSetupForm.test.ts`
- Depends on: Task 2.1

### Task 3.4 설정 페이지 (`/setup`)
- Description: 월급·잔고 설정 화면을 만듭니다. 첫 설정과 수정에 같은 화면을 씁니다.
  - state 읽기: `const state = parseSetupState(useLocation().state)`
    - null이면 저장된 설정 유무로 mode를 정합니다.
    - 'edit'인데 설정이 없으면 'onboarding'으로 처리합니다.
  - 화면 구성: PageShell > ScreenScaffold
    - Top: onboarding "텅장달력 시작하기", edit "월급·잔고 설정"
    - NumericField 3개
    - Paragraph.Text '월급일이 주말이면' + `Chip`/`ChipItem` 3개('그대로'/'직전 평일'/'다음 평일')
    - 잔고 도움말 "오늘 나간 돈·들어온 돈이 반영된 잔고를 넣어주세요"
    - edit 모드에서 '잔고 기준일: {M}월 {D}일'
    - 블록 사이 `Spacing size={24}`
    - SubmitFooter(onboarding '다음' / edit '저장', `disabled = !canSubmit`). FloatingTabBar는 없습니다.
  - `focus: 'balance'`면 잔고 필드에 자동 포커스합니다.
  - `<form onSubmit>`으로 감싸고, Enter는 `canSubmit`일 때만 제출합니다.
  - 제출 순서
    1. `validateSetupValues` 통과
    2. `logClick('setup_save')`
    3. `balanceAsOf` 결정: onboarding이거나 잔고 숫자가 저장값과 다르면 today, 아니면 기존 값
    4. Provider `saveSettings`
  - 결과 처리
    - onboarding 성공: `navigate('/items', { state: { from: 'onboarding' } satisfies ItemsLocationState })`
    - edit 성공: Toast "저장했어요" 후 `navigate('/', { replace: true })`
    - 실패(quota·unknown): Toast "저장하지 못했어요. 다시 시도해주세요". 이동하지 않고 입력 4개를 유지합니다.
- DoD:
  - RTL + MemoryRouter 테스트가 통과한다(today mock).
  - F2-AC-1: 저장값이 BASE_SETTINGS와 deep-equal(키 6개)이고, `logClick('setup_save')` 1회, navigate 인자가 정확하다.
  - F2-AC-2: 월급만 바꾸면 asOf `'2026-10-11'`이 유지되고, 잔고를 '1,000,000'으로 바꾸면 asOf `'2026-10-20'`이다. Toast "저장했어요"가 뜨고 replace로 이동한다.
  - F2-AC-5·11: quota·unknown 모두 Toast가 뜨고, navigate 0회, 입력 4개가 유지되며, console.error는 0회다.
  - F2-AC-6·10: 빈 필드가 있을 때 잔고 필드에서 Enter를 눌러도 저장소 쓰기가 0회다.
  - F2-AC-7: 버튼이 활성일 때 잔고 필드 Enter로 저장된다.
  - F2-AC-8: `{ mode: 'edit', focus: 'balance' }`이면 잔고 필드가 `document.activeElement`이고 '잔고 기준일: 10월 11일'이 보인다.
  - F2-AC-12: `visibilitychange`(hidden→visible) 뒤 입력값이 유지된다. 재마운트(재로드 모사) 시 빈 값이고 Toast가 없다.
  - `location.state = null`로 직접 진입해도 크래시하지 않고, 설정 유무에 따라 onboarding 또는 edit로 렌더된다.
  - 인라인 `style`의 padding·margin이 0건이다.
- Covers: [F2-AC-1, F2-AC-2, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-8, F2-AC-10, F2-AC-11, F2-AC-12]
- Files: `src/pages/Setup.tsx`, `src/pages/Setup.test.tsx`
- Depends on: Task 2.10, Task 3.2, Task 3.3

### Task 3.5 출금 항목 BottomSheet (추가·수정 공용)
- Description: 출금 항목을 추가하고 수정하는 공용 시트 `OutflowSheet`를 만듭니다.
  - props: `mode: 'add' | 'edit'`, `initial`, `onSubmit(values) => SaveResult`, `onDelete?() => SaveResult`, `onClose`
  - 구성(TDS BottomSheet)
    - TextField '이름'(`maxLength={20}`, placeholder "예: 월세")
    - 추가 모드에만 ChipItem 프리셋 5개('월세', '카드값', '통신비', '보험료', '구독료'). 탭하면 이름을 채웁니다.
    - NumericField '금액'(원), '매월 출금일'(일)
    - Chip '주말이면'. 추가 모드 초기값은 `DEFAULT_WEEKEND_RULE`입니다.
    - Button display="block" '추가하기'/'저장하기'
    - 수정 모드에만 Button color danger, variant weak '삭제'
  - 버튼은 세 필드 중 하나라도 ''이면 `disabled`입니다. 공백만 있는 이름은 빈 값으로 보지 않습니다.
  - blur 문구: "항목 이름을 입력해주세요" / "금액을 입력해주세요" / "출금일을 입력해주세요"
  - 제출 시 검증 문구
    - 이름이 trim 후 비어 있음: "항목 이름을 입력해주세요"
    - 금액 0: "0원보다 큰 금액을 입력해주세요"
    - 금액 1억 초과: "1억 원 이하로 입력해주세요"
    - 날짜 범위 밖: "1~31 사이 날짜를 입력해주세요"
  - 추가 모드에서 검증을 통과하면 `logClick('outflow_add_submit')`를 호출합니다.
  - `onSubmit`이 실패하면 시트를 연 채 입력을 유지합니다.
  - 삭제는 AlertDialog "'{이름}' 항목을 삭제할까요?"로 확인합니다.
    - '삭제'를 누르면 `onDelete`를 호출하고 다이얼로그를 닫습니다. 실패해도 시트는 열어 둡니다.
    - '취소'를 누르면 다이얼로그만 닫습니다.
- DoD:
  - RTL 테스트가 통과한다.
  - F3-AC-5: 다섯 케이스의 문구가 맞고, `onSubmit` 호출이 0회이며, 이름 필드의 `maxLength`가 20이다.
  - F3-AC-9: 빈 필드가 있으면 버튼이 disabled이고, blur 문구 3종이 나온다. 이름이 `'   '`이면 버튼이 활성이다.
  - 추가 모드에서 프리셋 '카드값'을 탭하면 이름 필드가 '카드값'이다.
  - 추가 모드에서 '주말이면' Chip의 선택값이 '그대로'(`DEFAULT_WEEKEND_RULE`)다. 이 파일에 `'none'` 리터럴이 0건이다(grep).
  - `onSubmit`이 `{ ok: false, … }`를 돌려주면 시트가 열린 채 입력값이 유지된다.
  - `visibilitychange`(hidden→visible) 뒤에도 입력값이 유지된다.
  - 삭제 다이얼로그에서 '취소'를 누르면 `onDelete` 호출이 0회다.
- Covers: [F3-AC-4(프리셋 채움), F3-AC-5, F3-AC-9, F3-AC-11(입력 유지 부분)]
- Files: `src/components/items/OutflowSheet.tsx`, `src/components/items/OutflowSheet.test.tsx`
- Depends on: Task 3.2

### Task 3.6 출금 항목 페이지 (`/items`)
- Description: 출금 항목 목록 화면을 만들고 시트와 Provider를 연결합니다.
  - state 읽기: `parseItemsState(useLocation().state)`
    - `openAdd: true`면 진입 직후 처리합니다. 30개 미만이면 추가 시트를 열고, 30개면 Toast "출금 항목은 30개까지 등록할 수 있어요"를 띄웁니다.
    - 처리 직후 `navigate('.', { replace: true, state: { ...state, openAdd: false } })`
  - 화면 구성
    - Top "출금 항목"
    - outflow-total(`data-testid`): "매월 출금 합계 {합}원 · 월급의 {Math.round(%)}%" + MiniBar. 설정이 없으면 비율을 생략합니다.
    - `Spacing size={16}`
    - Button '출금 추가'(block, weak)
    - ListRow 목록: "{이름}" / "매월 {day}일 · 주말이면 {라벨}" / "{금액}원"
      - 표시만 day 오름차순으로 정렬하고, 같으면 배열 순서입니다. 저장 순서는 바꾸지 않습니다.
  - 빈 상태: Asset.ContentIcon, "아직 등록한 출금이 없어요", 프리셋 ChipItem 5개(탭하면 그 이름으로 시트를 엶)
  - 동작
    - 추가: `addOutflow({ name: trim, amount, day, weekendRule })` → 성공 시 Toast "추가했어요"
    - 수정: `base = applyDayChangeToItem(orig, newDay, today)`를 만든 뒤 `{ id, name, amount, weekendRule, day: base.day }`를 필드별로 새로 만듭니다. `base.dayChange`가 있을 때만 키를 넣습니다. `replaceOutflow` → 성공 시 Toast "저장했어요"
    - 삭제: `removeOutflow` → 성공 시 Toast "삭제했어요"
    - 실패: Toast "저장하지 못했어요. 다시 시도해주세요"
  - 하단
    - `from === 'onboarding'`이면 SubmitFooter '달력 보기'(항목 0개여도 활성) → `navigate('/', { replace: true })`
    - 그 외에는 `<FloatingTabBar>`에 `APP_TABS`(2.1)를 넘깁니다. 이 파일에서 탭 배열을 정의하지 않습니다.
- DoD:
  - RTL + MemoryRouter 테스트가 통과한다.
  - F3-AC-1: 저장 항목 키가 정확히 5개다. '  월세  '는 '월세'로 저장되고, 새 항목은 끝에 붙는다. Toast "추가했어요"와 ListRow 텍스트가 보이고, logClick이 1회다.
  - F3-AC-2: `items[0]`이 SPEC 값과 같고 `dayChange`가 없으며, 나머지 3개 순서가 유지된다. Toast "저장했어요"가 뜬다.
  - F3-AC-3: 삭제 후 `items`가 3개이고 Toast "삭제했어요"가 뜬다. 취소하면 4개가 유지된다.
  - F3-AC-4: 빈 상태 아이콘·문구와 칩 5개가 보인다.
  - F3-AC-6: 30개일 때 '출금 추가'를 누르면 시트가 열리지 않고 Toast가 뜨며, 항목 수가 30개로 유지된다.
  - F3-AC-7: 표시 순서가 카드값 → 넷플릭스 → 통신비 → 월세이고, 저장 쓰기가 0회다. 합계 문구가 "매월 출금 합계 1,052,000원 · 월급의 42%"다.
  - F3-AC-8·10: quota·unknown 각각에서 목록이 유지되고 시트가 열린 채 입력이 남는다. 삭제 실패면 다이얼로그는 닫히고 시트는 남는다. 성공 Toast는 0회다.
  - F3-AC-11: `openAdd` 처리 후 navigate가 `('.', { replace: true, state: { openAdd: false } })` 형태로 호출된다. 재마운트하면 시트가 닫혀 있다.
  - F3-AC-12: 대기 중인 dayChange가 있는 카드값의 금액만 바꾸면 dayChange가 유지된다. 날짜를 10으로 바꾸면 저장 문자열에 `"dayChange"`가 없다.
  - `location.state = null`로 직접 진입해도 크래시하지 않고, FloatingTabBar가 있는 목록이 렌더된다.
  - `Items.tsx`·`OutflowList.tsx`에 `'/items'`를 포함한 탭 배열 리터럴이 없고, `APP_TABS`를 import한다(grep).
- Covers: [F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-4, F3-AC-6, F3-AC-7, F3-AC-8, F3-AC-10, F3-AC-11, F3-AC-12]
- Files: `src/pages/Items.tsx`, `src/components/items/OutflowList.tsx`, `src/pages/Items.test.tsx`
- Depends on: Task 2.1, Task 2.10, Task 3.5

### Task 3.7 달력 그리드 + 날짜 상세 시트
- Description: 잔고 달력과 날짜 상세 시트를 만듭니다.
  - `CalendarGrid({ model })`
    - Card 안에 `data-testid="calendar-grid"`, 머리줄 '일 월 화 수 목 금 토'
    - 커스텀 CSS는 `display: grid; grid-template-columns: repeat(7, 1fr)`와 칸 최소 크기 48×48px만 씁니다.
    - 칸마다 `data-testid="day-cell-YYYY-MM-DD"`를 붙입니다.
    - 칸 내용: 이름 1개(말줄임) + `+N`. `showBalance`면 `formatCompactWon(endBalance)`를 표시합니다.
    - 색상: 음수 `var(--adaptiveRed500)`, 지난 날 글자 `var(--adaptiveGrey400)`, 크런치 배경 `var(--adaptiveRed50)`
    - `data-crunch="true"`, `data-lowest="true"` 속성을 붙입니다.
    - `tappable`인 칸만 `role="button"`과 onClick을 가집니다. **[U-5, SPEC 반영 대기]**
  - `DayDetailSheet`
    - 제목 "10월 24일 (토)"
    - 이벤트별 ListRow "월세 -550,000원"
    - "하루 마감 잔고 {end}원"
    - lowBalance가 endBalance와 다르면 "출금 후 최저 {low}원"
    - 이벤트가 없으면 "이날은 출금·입금이 없어요"
- DoD:
  - 2.9 모델을 주입한 RTL 테스트가 통과한다.
  - F4-AC-1: day-cell-2026-10-24에 '월세'와 '-25.2만'이 있고, 금액 색이 `var(--adaptiveRed500)`다.
  - F4-AC-2: 10-01이 5번째 열에서 시작한다(빈칸 4개). 날짜 칸이 31개이고, 10-01~10-10에는 잔고가 없다. 10-11은 '80만', 10-14는 '38만', 10-25는 '224.8만'이며, 이름이 2개 이상인 칸에 `+N`이 있다.
  - F4-AC-4: 10-24를 탭하면 제목, "월세 -550,000원", "하루 마감 잔고 -252,000원"이 보인다. 10-12를 탭하면 빈 문구와 "하루 마감 잔고 800,000원"이 보인다. F1-AC-3 픽스처에서 10-25를 탭하면 "출금 후 최저 -200,000원"이 보인다.
  - F4-AC-10: day-cell-2026-10-05에 '관리비'가 grey400으로 있고 잔고 숫자가 없다.
  - [U-5] day-cell-2026-10-05를 탭해도 BottomSheet가 열리지 않고, 이 칸에 `role="button"`이 없다.
  - F5-AC-2: 변형 설정에서 10-21·10-22 칸에 `data-crunch="true"`, 10-21 칸에 `data-lowest="true"`가 있다.
  - 두 파일에 HEX 리터럴이 0건이다.
- Covers: [F4-AC-1, F4-AC-2, F4-AC-4, F4-AC-10, F5-AC-2(칸 강조), U-5(제안)]
- Files: `src/components/home/CalendarGrid.tsx`, `src/components/home/CalendarGrid.css`, `src/components/home/DayDetailSheet.tsx`, `src/components/home/CalendarGrid.test.tsx`
- Depends on: Task 2.9

### Task 3.8 출금 일정 목록
- Description: `ScheduleList({ rows })`를 만듭니다.
  - `data-testid="schedule-list"`, TDS ListRow로 행마다 label·sub를 표시합니다. 문자열은 2.9 모델 그대로 씁니다.
  - 등록한 항목은 자기 이름으로 한 줄씩 나오며, 합계로 묶지 않습니다.
- DoD:
  - RTL 테스트가 통과한다.
  - F4-AC-3: BASE 5행의 텍스트가 SPEC과 정확히 같다. 변형 설정의 월세 행에 "주말이라 10월 26일(월)로"가 있다.
  - F4-AC-10: 관리비를 포함하면 6행이고, 첫 행이 "10월 5일 (월) 관리비" / "-100,000원 · 지남"이다.
  - [U-4] balanceHidden 모델이면 행 수가 유지되고, 화면 텍스트에 '잔고'가 0건이다.
- Covers: [F4-AC-3, F4-AC-10, U-4(제안)]
- Files: `src/components/home/ScheduleList.tsx`, `src/components/home/ScheduleList.test.tsx`
- Depends on: Task 2.9

### Task 3.9 최저 잔고일 카드 + 공유
- Description: 최저 잔고일 카드와 공유 버튼을 만듭니다.
  - `LowestDayCard({ model, isCurrentMonth })`: `data-testid="lowest-day-card"` Card
    - 제목: 이번 달이면 "이번 달 최저 잔고일 · {날짜}", 아니면 "{M}월 최저 잔고일 · {날짜}"
    - SummaryHero value + CountUp(최종값 "{balance}원", t2)
    - lowest < 0이면 Badge "잔고 부족"과 "{firstNegative}부터 마이너스예요 · {부족액}원 부족"
    - 크런치 문구: 2일 이상이면 "월급 전 최저 구간 {start} ~ {end} ({n}일)", 1일이면 "월급 전 최저 구간 {날짜} 하루"
    - `data-testid="balance-sparkline"` Sparkline(최저점 표시)
    - 첫 노출 시 `logImpression('lowest_day_card')`를 1회 호출합니다(ref 가드).
  - `ShareButton`: display="block" '내 잔고 달력 공유하기'
    - `logClick('share_calendar')` 후 `shareApp()`
    - reject되면 Toast "공유하지 못했어요"
- DoD:
  - RTL 테스트가 통과한다.
  - F5-AC-1: 제목 "이번 달 최저 잔고일 · 10월 24일 (토)", CountUp 최종값 "-252,000원", Badge "잔고 부족", "10월 24일부터 마이너스예요 · 252,000원 부족"이 보인다. StrictMode에서도 logImpression은 1회다.
  - F5-AC-2: 변형 설정이면 "월급 전 최저 구간 10월 21일 ~ 10월 22일 (2일)"과 "298,000원"이 보이고 Badge는 없다.
  - F5-AC-3: 11월이면 "11월 최저 잔고일 · 11월 24일 (화)", "1,196,000원", "월급 전 최저 구간 11월 24일 하루"가 보인다.
  - F5-AC-4: balance-sparkline의 점이 21개이고, 최저점 표시가 10-24 위치에 있다.
  - F5-AC-6: 탭하면 logClick과 shareApp이 각 1회 호출된다. shareApp이 reject하면 Toast "공유하지 못했어요"가 뜨고 unhandled rejection은 0이다.
- Covers: [F5-AC-1, F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-6]
- Files: `src/components/home/LowestDayCard.tsx`, `src/components/home/ShareButton.tsx`, `src/components/home/LowestDayCard.test.tsx`
- Depends on: Task 2.9

### Task 3.10 시뮬레이션 섹션 (teaser + 리워드 게이트 + 잠금 층 목록)
- Description: 리워드 광고로 여는 시뮬레이션 영역을 만듭니다.
  - `SimSection({ settings, outflows, today, onRowTap })`: `data-testid="sim-section"`
    - 세션 상태 `unlocked`를 둡니다. 저장하지 않습니다.
    - `!unlocked`이면 게이트 바깥에 `data-testid="locked-teaser"`를 렌더합니다.
      - Paragraph.Text "항목별로 가장 유리한 출금일을 찾아드려요"
      - Paragraph.Text "광고를 끝까지 보면 열려요"
    - `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 안에는 `<LockedTier …/>`만 둡니다.
  - `LockedTier`: `data-testid="locked-tier"`
    - 마운트 effect에서 `onUnlocked()`와 `logImpression('sim_locked_tier')`를 1회 호출합니다(ref 가드).
    - 제목 "출금일을 옮기면"
    - `useMemo(bestShifts)` 결과를 ListRow `data-testid="sim-row-{id}"`로 표시합니다. **보조 텍스트는 F6-AC-2 문자열과 정확히 같게** 만듭니다.
      - improved 행의 주 텍스트: "{name} {from}일 → {to}일"
      - improved 행의 보조 텍스트
        - 목록 첫 행(index 0): "최저 잔고 +{delta}원"
        - 둘째 행부터: "+{delta}원"
      - 그 외 행: "{name} {from}일 · 지금 날짜가 가장 유리해요" / "변화 없음 (0원)"
    - 하단 Paragraph.Text "오늘부터 다음 달 말일까지의 예상 잔고 기준이에요. 실제로 바꿀 수 있는 날짜는 카드사·은행에 확인하세요"(링크 없음)
    - 행을 탭하면 `onRowTap(result)`를 호출합니다.
  - SimSection과 TossRewardAd에 동적 key를 주지 않습니다. outflows 변경은 props로만 전달합니다.
  - 게이트 동작(로딩 표시, 타임아웃, 실패 시 자동 열림)은 템플릿을 그대로 씁니다. F6-AC-13 정책은 U-1에서 PM 확인을 요청했지만, 구현은 SPEC대로 합니다.
- DoD:
  - TossRewardAd 모듈을 4가지 모드(`pending`·`완료`·`닫음`·`자동열림`)로 mock한 RTL 테스트가 통과한다.
  - F6-AC-2: 완료 모드에서 행 4개가 월세·카드값·통신비·넷플릭스 순으로 있고, 각 행의 주·보조 텍스트가 **정확히 일치(exact match)**한다.
    - sim-row-o-rent: "월세 24일 → 26일" / "최저 잔고 +550,000원"
    - sim-row-o-card: "카드값 14일 → 26일" / "+420,000원"
    - sim-row-o-phone: "통신비 21일 → 26일" / "+65,000원"
    - sim-row-o-netflix: "넷플릭스 18일 → 26일" / "+17,000원"
    - 하단 안내가 있고, teaser는 없으며, logImpression은 1회다.
  - F6-AC-6: day 26인 항목 하나만 있으면 "월세 26일 · 지금 날짜가 가장 유리해요" / "변화 없음 (0원)"이고, '→'가 없다.
  - F6-AC-11: pending 모드에서 teaser 2줄이 보이고 locked-tier는 DOM에 없으며, logImpression은 0회다.
  - F6-AC-12: 닫음 모드에서 locked-tier가 없고 teaser가 유지된다. Toast와 저장소 쓰기는 0회다.
  - F6-AC-13: 자동열림 모드에서 sim-row 4개가 보이고, 실패 문구·Toast는 0개, logImpression은 1회다.
  - F6-AC-1(구조): TossRewardAd의 자식이 locked-tier 하나뿐이고, locked-teaser는 바깥에 있다.
  - outflows prop을 바꿔 리렌더해도 locked-tier가 언마운트되지 않는다(remount 0회).
- Covers: [F6-AC-1(구조), F6-AC-2, F6-AC-6, F6-AC-11, F6-AC-12, F6-AC-13]
- Files: `src/components/home/SimSection.tsx`, `src/components/home/LockedTier.tsx`, `src/components/home/SimSection.test.tsx`
- Depends on: Task 2.8

### Task 3.11 출금일 바꿔보기 시트
- Description: `SimDaySheet({ item, defaultDay, settings, outflows, today, onClose })`, BottomSheet "출금일 바꿔보기"를 만듭니다.
  - NumericField 날짜. 기본값은 `defaultDay`(추천 toDay)입니다.
  - 비교 문구 "지금 최저 {baseMin}원 → 바꾸면 {newMin}원 ({±delta}원)"을 `simulateShift`로 계산합니다.
    - delta가 0이면 `(0원)`, 음수면 `(-X원)`으로 씁니다(SPEC 명시 요청 U-9).
  - 29~31일이면 Paragraph.Text "29~31일은 그 날짜가 없는 달에 말일로 계산해요"를 표시합니다.
  - 오류 처리: 오류 상태에서는 비교 문구를 숨기고, 저장 버튼을 disabled로 하며, Enter도 무시합니다.
    - 빈 값: "바꿀 날짜를 입력해주세요"
    - 0 또는 32: "1~31 사이 날짜를 입력해주세요"
  - '이 날짜로 저장'(block)
    1. `logClick('sim_save_day')`
    2. `replaceOutflow(item.id, applyDayChangeToItem(item, d, today))`
  - 성공하면 Toast "{name} 출금일을 {d}일로 바꿨어요"를 띄우고 시트를 닫습니다. 이어서 `try { Promise.resolve(requestReviewOnce()).catch(() => {}) } catch {}`를 실행합니다.
  - 실패하면 Toast "저장하지 못했어요. 다시 시도해주세요"를 띄우고, 시트와 입력을 유지하며, `requestReviewOnce`를 호출하지 않습니다.
- DoD:
  - Provider를 포함한 RTL 테스트가 통과한다.
  - F6-AC-5
    - 월세 시트의 기본값이 26이다.
    - '28'을 입력하면 "지금 최저 -252,000원 → 바꾸면 298,000원 (+550,000원)"이 보인다.
    - 저장하면 `items[0]`이 `{ id: 'o-rent', name: '월세', amount: 550000, day: 28, weekendRule: 'none' }`이고 dayChange 키가 없다.
    - Toast "월세 출금일을 28일로 바꿨어요"가 뜨고, logClick과 requestReviewOnce가 각 1회다.
  - F6-AC-7: '0'·'32'이면 문구가 보이고, 비교 문구가 숨겨지며, 버튼이 disabled다. quota면 Toast가 뜨고 day 24가 유지된다.
  - F6-AC-9: 빈 값이면 "바꿀 날짜를 입력해주세요"가 보이고 버튼이 disabled다. Enter를 눌러도 save와 logClick이 0회다. '26'을 다시 넣으면 비교 문구와 버튼이 돌아온다.
  - F6-AC-10: '31'이면 비교 문구와 29~31 안내가 보이고, 1~28에서는 안내가 없다. 저장하면 day 31(dayChange 없음)이고 Toast "월세 출금일을 31일로 바꿨어요"가 뜬다.
  - F6-AC-14: requestReviewOnce가 reject하거나 throw해도 Toast는 성공 문구 1개뿐이고 시트가 닫히며, unhandled rejection과 console.error가 0이다.
  - F6-AC-15: unknown이면 Toast가 뜨고, 시트에 '28'이 남으며, day는 24, logClick 1회, requestReviewOnce 0회다.
- Covers: [F6-AC-5, F6-AC-7, F6-AC-9, F6-AC-10, F6-AC-14, F6-AC-15]
- Files: `src/components/home/SimDaySheet.tsx`, `src/components/home/SimDaySheet.test.tsx`
- Depends on: Task 2.10, Task 3.2, Task 3.10

### Task 3.12 홈 페이지 조립 (`/`)
- Description: 홈 화면을 조립합니다. 계산과 컴포넌트는 앞 태스크의 것을 씁니다.
  - state를 쓰지 않습니다(`RouteState['/']` = null). `useLocation().state`를 읽지 않습니다.
  - 골격: PageShell > ScreenScaffold
    - Top "텅장달력". 우측 텍스트 버튼 '월급·잔고' → `navigate('/setup', { state: { mode: 'edit' } satisfies SetupLocationState })`
    - `<FloatingTabBar>`에 `APP_TABS`(2.1)를 넘깁니다. 이 파일에서 탭 배열을 정의하지 않습니다.
  - TDS Tab '이번 달 ({M}월)' / '다음 달 ({M+1}월)'. 기본은 이번 달이고 로컬 상태입니다.
  - 모델: `useMemo(() => buildHomeModel(...))`
  - 배치(위→아래)
    1. `data-testid="free-tier"`: [stale 슬롯(3.13에서 채움)] → LowestDayCard → `Spacing size={16}` → CalendarGrid → `Spacing size={16}` → ScheduleList
    2. free-tier 바깥에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`
       - `logImpression('banner_calendar')`는 템플릿 AdSlot이 노출 콜백 prop을 제공하면 거기에 연결합니다.
       - 제공하지 않으면 AdSlot을 감싼 컨테이너가 처음 화면에 보일 때(IntersectionObserver) 1회 호출합니다(U-9). AdSlot은 수정하지 않습니다.
    3. SimSection
    4. ShareButton
  - 출금 0개(빈 상태)
    - free-tier 상단에 Asset.ContentIcon, "출금 항목을 등록하면 잔고가 얇아지는 날을 찍어드려요", Button block '출금 항목 추가' → `navigate('/items', { state: { openAdd: true } satisfies ItemsLocationState })`
    - LowestDayCard·ShareButton·SimSection은 마운트하지 않습니다. 달력에는 월급만 표시합니다.
  - SimSection 행을 탭하면 SimDaySheet를 엽니다.
- DoD:
  - TossRewardAd·AdSlot을 mock한 RTL + MemoryRouter 테스트가 통과한다.
  - F4-AC-1 (Value AC): BASE면 day-cell-2026-10-24에 '월세'와 '-25.2만'(red500)이 있고, lowest-day-card에 "10월 24일 (토)"와 "-252,000원"이 있다.
  - F4-AC-5: 출금이 0개면 빈 상태 문구가 보이고, 버튼의 navigate 인자가 정확하며, 달력에는 10-25 월급만 있다.
  - F4-AC-7: '다음 달 (11월)'을 탭하면 grid가 11월이고, 11-01이 1번째 열, 칸이 30개, 11-24에 '월세'·'119.6만'이 있으며, schedule-list가 5행이다.
  - F5-AC-5: DOM 순서가 schedule-list → AdSlot → sim-section이고 AdSlot이 free-tier 밖에 있다. 노출 시 logImpression('banner_calendar')가 1회 호출된다. AdSlot mock이 실패해도 세 영역이 렌더되고 오류 문구가 0이다.
  - F5-AC-7: 출금이 0개면 card와 공유 버튼이 없고, `logImpression('lowest_day_card')`가 0회다.
  - F6-AC-1: TossRewardAd가 슬롯 미설정·자동열림 모드여도 free-tier에 card, grid, schedule-list 5행이 있다.
  - F6-AC-8: 출금이 0개면 sim-section, locked-teaser, locked-tier, TossRewardAd mock의 마운트가 0회이고, 광고 로드 호출도 0회다.
  - 시뮬레이션 시트에서 28로 저장하면 lowest-day-card가 "298,000원"으로 다시 계산된다.
  - state 없이 `/`로 직접 진입해도 크래시하지 않는다.
  - `Home.tsx`가 `APP_TABS`를 import하고 탭 배열 리터럴이 없다(grep).
- Covers: [F4-AC-1, F4-AC-5, F4-AC-7, F5-AC-5, F5-AC-7, F6-AC-1, F6-AC-8]
- Files: `src/pages/Home.tsx`, `src/components/home/EmptyOutflows.tsx`, `src/pages/Home.test.tsx`
- Depends on: Task 2.1, Task 3.7, Task 3.8, Task 3.9, Task 3.10, Task 3.11

### Task 3.13 홈 진입 가드: 설정 리다이렉트 · 복구 Toast · 월 이월 · 기준일 관리
- Description: 홈에 진입할 때의 일회성 처리와 기준일 안내를 만들어 Home에 연결합니다.
  - `useHomeEntry()` 훅. 일회성 effect는 ref 가드로 1회만 실행합니다.
    1. settings가 null이면
       - `recovery.settings`가 true일 때만 Toast "저장된 정보를 불러오지 못해 다시 입력이 필요해요"를 띄우고 `consumeRecovery`
       - `navigate('/setup', { replace: true, state: { mode: 'onboarding' } })` 후 종료
    2. `recovery.outflows`가 true면 Toast "일부 출금 항목을 불러오지 못했어요"를 띄우고 `consumeRecovery`
    3. 메타 처리: `meta = loadMeta()`, `cur = monthOf(today)`
       - `meta?.lastSeenMonth`가 있고 `!== cur`이면 Toast "{M}월 달력으로 넘어왔어요"
       - meta가 null이거나 `lastSeenMonth !== cur`이면 `saveMeta({ version: 1, lastSeenMonth: cur })`. 실패해도 알리지 않습니다.
  - `StaleBalanceRow`(isStaleMonth일 때): `data-testid="stale-balance-row"` ListRow "잔고 기준일이 {M}월 {D}일이에요" / "지금 잔고로 바꾸기" → `navigate('/setup', { state: { mode: 'edit', focus: 'balance' } })`
  - `StaleBlocked`(balanceHidden일 때)
    - Asset.ContentIcon, "잔고 기준일이 너무 오래됐어요 ({M}월 {D}일)", Button block '지금 잔고 입력'(같은 이동)
    - LowestDayCard·SimSection·ShareButton은 렌더하지 않습니다.
    - calendar-grid와 schedule-list는 2.9 모델대로 잔고 없이 렌더합니다(U-4).
- DoD:
  - RTL 테스트가 통과한다(StrictMode 포함).
  - F4-AC-6: 설정 키가 없으면 Toast 0회, 손상이면 Toast 1회이고, 둘 다 navigate 인자가 `('/setup', { replace: true, state: { mode: 'onboarding' } })`다.
  - F4-AC-9
    - `'{bad'`·`'{"a":1}'`이면 Toast 1회와 빈 상태가 보인다.
    - 넷플릭스가 -5면 schedule-list가 카드값·통신비·월세·월급 4행이다.
    - 재진입(재마운트) 시 Toast는 0회다.
  - F7-AC-1: meta '2026-10', today 11-02면 Tab 라벨이 '이번 달 (11월)'/'다음 달 (12월)'이고, Toast "11월 달력으로 넘어왔어요"가 1회 뜬다. 저장값은 `{ version: 1, lastSeenMonth: '2026-11' }`이고, 재진입 시 Toast는 0회다.
  - F7-AC-2: today 11-02면 11월 schedule-list에 4개 항목 이름이 모두 있다.
  - F7-AC-3: stale 행 텍스트 "잔고 기준일이 10월 11일이에요" / "지금 잔고로 바꾸기"가 보이고, 탭하면 navigate 인자가 정확하다.
  - F7-AC-5: today 12-13이면 grid의 잔고 숫자가 0개이고 card·sim-section이 없으며, 안내 문구와 '지금 잔고 입력' 버튼이 있다. 12-12면 잔고가 표시된다.
  - F7-AC-6: 메타 손상 5종, 키 없음, `lastSeenMonth: null`이면 Toast가 0회이고 저장값이 `{ version: 1, lastSeenMonth: '2026-10' }`다.
  - F7-AC-8·9: saveMeta가 quota·unknown이면 홈이 정상 렌더되고, 새 달 Toast 1회, 에러 Toast 0회이며, 저장값 '2026-10'이 유지된다.
  - StrictMode에서 모든 Toast의 중복이 0이고, console.error가 0회다.
- Covers: [F4-AC-6, F4-AC-9, F7-AC-1, F7-AC-2, F7-AC-3, F7-AC-5, F7-AC-6, F7-AC-8, F7-AC-9]
- Files: `src/pages/home/useHomeEntry.ts`, `src/components/home/StaleBalanceRow.tsx`, `src/components/home/StaleBlocked.tsx`, `src/pages/home/useHomeEntry.test.tsx`, `src/pages/Home.tsx`
- Depends on: Task 3.12

---

## Epic 4. 통합 + 검수 마감

**Risk**
- Complexity: Medium
- Risk factors:
  - Provider가 StorageGuard 바깥에 있으면, 저장소 접근이 막힌 환경에서 load가 먼저 실행됩니다.
  - `*` 리다이렉트가 replace가 아니면 뒤로 가기 루프가 생깁니다.
  - 화면 간 흐름은 단위 테스트에서 연결되지 않습니다.
  - 검수 반려 요인(HEX, 외부 URL, '설치' 문구, 호환 API, console.error, helper를 거치지 않은 저장소 접근)이 늦게 발견될 수 있습니다.
- Mitigation:
  - 트리 순서를 `StorageGuard > AppDataProvider > Routes`로 고정합니다.
  - 전체 App을 MemoryRouter로 띄우는 통합 테스트를 둡니다.
  - 정적 검사를 `npm run check`에 넣어 빌드 전에 실패시킵니다.

### Task 4.1 앱 라우팅 연결
- Description: App 트리와 라우트를 연결합니다.
  - `App.tsx`
    ```tsx
    <StorageGuard>
      <AppDataProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/items" element={<Items />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppDataProvider>
    </StorageGuard>
    ```
  - `main.tsx`는 템플릿의 BrowserRouter를 그대로 씁니다.
  - 탭 설정은 2.1의 `APP_TABS`를 그대로 씁니다. 이 태스크에서는 만들지 않습니다.
- DoD:
  - App 통합 테스트가 통과한다.
  - F4-AC-11
    - probe가 false면 `/`, `/setup`, `/items` 모두 storage-unavailable이 렌더된다.
    - `/setup`으로의 navigate, 다른 Toast, FloatingTabBar, AdSlot, TossRewardAd가 모두 0이다.
    - mock을 해제하고 BASE를 seed한 뒤 '다시 시도'를 누르면 홈 card "10월 24일 (토)"가 보인다.
  - F4-AC-12
    - `/result`나 `/foo/bar`로 진입하면 pathname이 '/'가 되고 홈이 렌더되며, Toast는 0이다.
    - 이력 항목 수가 늘지 않아(replace) 뒤로 가기로 `/result`에 돌아가지 않는다.
    - 설정이 없으면 이어서 `/setup` onboarding으로 간다.
  - 홈과 `/items`에서 렌더된 FloatingTabBar의 탭 라벨이 둘 다 '달력', '출금 항목' 순서다.
  - `npx tsc --noEmit`가 통과한다.
- Covers: [F4-AC-11, F4-AC-12]
- Files: `src/App.tsx`, `src/main.tsx`, `src/App.test.tsx`
- Depends on: Task 3.1, Task 3.4, Task 3.6, Task 3.13

### Task 4.2 화면 간 흐름 통합 테스트
- Description: 전체 App을 MemoryRouter로 띄우고 today를 mock한 시나리오 테스트를 작성합니다. 흐름에서 버그가 나오면 해당 페이지 파일을 최소 범위로 고칩니다.
  1. 첫 실행: 빈 저장소 → `/setup` onboarding → 입력 후 '다음' → `/items` → 월세 추가 → '달력 보기' → 홈 card 표시
  2. 설정 손상: `pcm.settings.v1 = '{bad'` → 홈 진입 → Toast + `/setup` onboarding
  3. 기준일 갱신: today 11-02, BASE → stale 행 탭 → `/setup` 잔고 필드 포커스 + '잔고 기준일: 10월 11일' → '1,500,000' 저장 → 홈 복귀
  4. 시뮬레이션 저장 반영: 잠금 층 열림 → 월세 28일 저장 → card "298,000원"
- DoD:
  - 시나리오 4개가 모두 통과한다.
  - F2-AC-1: 시나리오 1에서 저장값 키 6개가 BASE_SETTINGS와 같고, `/items` 진입 state가 `{ from: 'onboarding' }`다.
  - F4-AC-6: 시나리오 2에서 Toast "저장된 정보를 불러오지 못해 다시 입력이 필요해요"가 1회 뜨고, pathname이 `/setup`이다.
  - F2-AC-8·F7-AC-4: 시나리오 3에서 잔고 필드가 포커스되고, 저장 후 `balanceAsOf`가 `'2026-11-02'`다. stale 행이 사라지고, card가 "11월 24일 (화)"와 "448,000원"이다.
  - F6-AC-5: 시나리오 4에서 저장값 day 28, Toast, card "298,000원"이 확인된다.
  - 전 시나리오에서 console.error가 0회다.
- Covers: [F2-AC-1, F2-AC-8, F4-AC-6, F6-AC-5, F7-AC-4]
- Files: `src/test/flows.test.tsx`
- Depends on: Task 4.1

### Task 4.3 검수 정적 검사 + 프로덕션 점검
- Description: 검수 반려 요인을 빌드 전에 잡는 정적 검사 스크립트를 만듭니다.
  - `scripts/check-compliance.mjs`가 `src/` 전체(테스트 파일 제외)를 검사하고, 아래 중 1건이라도 있으면 exit 1입니다.
    - `#[0-9a-fA-F]{3,8}\b` 색상 리터럴(CSS 포함)
    - `window.open(`, `location.href = 'http`
    - '설치', '다운로드'
    - `crypto.randomUUID`, `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter`, `toISOString`
    - 외부 분석 SDK import(`react-ga`, `@amplitude`, `firebase/analytics`, `mixpanel`)
    - `shadcn`, `@mui`, `antd`, `@chakra-ui` import
    - 인라인 스타일의 padding·margin(`style={{ … padding|margin`)
    - `localStorage` 문자열. 단, `src/lib/store/storage.ts`와 템플릿 localStorage helper 파일은 예외입니다(SPEC "템플릿 helper 경유").
  - `package.json` scripts에 `"check": "node scripts/check-compliance.mjs && vitest run && tsc --noEmit"`를 추가합니다. devDependencies는 건드리지 않습니다(1.2에서 처리, 의존 체인 1.2 → … → 4.2 → 4.3).
  - `vite build` 후 `vite preview`에서 홈 → 설정 → 항목을 순회하며 콘솔 에러를 확인합니다.
- DoD:
  - `npm run check`가 exit 0이다.
  - 임시로 `#fff`를 넣으면 exit 1이다(확인 후 원복).
  - 임시로 `src/pages/Home.tsx`에 `localStorage.getItem('x')`를 넣으면 exit 1이다(확인 후 원복).
  - 마이너스·크런치·지난 날 색 변수가 각각 `--adaptiveRed500`, `--adaptiveRed50`, `--adaptiveGrey400`로 소스에 존재한다(grep 1건 이상).
  - `vite build`가 성공한다.
  - preview 순회 중 콘솔 에러가 0건이다.
- Covers: [F4-AC-8, F7-AC-7]
- Files: `scripts/check-compliance.mjs`, `package.json`
- Depends on: Task 4.2

---

## 의존 관계 요약
```
1.1 → 1.2 (테스트 환경·package.json)
1.1 → 2.1 (date/money/nav/tabs/defaults) → 2.2 → 2.3 ─┬→ 2.4 (2.5 필요)
                                                    ├→ 2.8 → 3.10 → 3.11
                                                    └→ 2.9 → 3.7 / 3.8 / 3.9
1.2 → 2.5 (helper 적합성 판정 → 어댑터·save) → 3.1
2.1 → 2.6 → 2.7 (2.5 필요) → 2.10 (2.4 필요)
2.1 → 3.2, 3.3 → 3.4 (2.10 필요)
3.2 → 3.5 → 3.6 (2.1·2.10 필요)
2.1, 3.7~3.11 → 3.12 → 3.13 → 4.1 → 4.2 → 4.3
```
- 같은 파일을 수정하는 태스크와 의존 관계
  - `src/pages/Home.tsx`: 3.12 → 3.13
  - `package.json`: 1.2 → (체인) → 4.3
  - `src/lib/nav/tabs.ts`: 2.1 하나만 만들고, 3.6·3.12·4.1은 읽기만 합니다.

## AC Coverage
- Total ACs in SPEC: 80
  - F1: 13, F2: 12, F3: 12, F4: 12, F5: 7, F6: 15, F7: 9
  - Value AC는 F4-AC-1이며 위 80개에 포함됩니다.
- Covered by tasks: 80 (아래 표)
- Uncovered: 0
- SPEC에 없는 제안 동작(U-4, U-5)은 80개에 넣지 않고 아래에 따로 적었습니다.

| AC | Tasks |
|---|---|
| F1-AC-1 | 2.3 |
| F1-AC-2 | 2.2, 2.3 |
| F1-AC-3 | 2.3 |
| F1-AC-4 | 2.7 |
| F1-AC-5 | 2.4 |
| F1-AC-6 | 2.7 |
| F1-AC-7 | 2.5 |
| F1-AC-8 | 2.3 |
| F1-AC-9 | 2.5 |
| F1-AC-10 | 2.5, 2.7 |
| F1-AC-11 | 2.6, 2.7 |
| F1-AC-12 | 2.6, 2.7 |
| F1-AC-13 | 2.4 |
| F2-AC-1 | 3.4, 4.2 |
| F2-AC-2 | 3.4 |
| F2-AC-3 | 3.3 |
| F2-AC-4 | 3.3 |
| F2-AC-5 | 2.10, 3.4 |
| F2-AC-6 | 3.3, 3.4 |
| F2-AC-7 | 3.2, 3.4 |
| F2-AC-8 | 3.4, 4.2 |
| F2-AC-9 | 3.2, 3.3 |
| F2-AC-10 | 3.3, 3.4 |
| F2-AC-11 | 2.10, 3.4 |
| F2-AC-12 | 3.4 |
| F3-AC-1 | 3.6 |
| F3-AC-2 | 3.6 |
| F3-AC-3 | 3.6 |
| F3-AC-4 | 3.5, 3.6 |
| F3-AC-5 | 3.5 |
| F3-AC-6 | 3.6 |
| F3-AC-7 | 3.6 |
| F3-AC-8 | 2.10, 3.6 |
| F3-AC-9 | 3.5 |
| F3-AC-10 | 2.10, 3.6 |
| F3-AC-11 | 3.5, 3.6 |
| F3-AC-12 | 3.6 |
| F4-AC-1 (Value) | 3.7, 3.12 |
| F4-AC-2 | 2.1, 2.9, 3.7 |
| F4-AC-3 | 2.2, 2.9, 3.8 |
| F4-AC-4 | 3.7 |
| F4-AC-5 | 3.12 |
| F4-AC-6 | 3.13, 4.2 |
| F4-AC-7 | 2.9, 3.12 |
| F4-AC-8 | 4.3 |
| F4-AC-9 | 2.10, 3.13 |
| F4-AC-10 | 2.2, 2.9, 3.7, 3.8 |
| F4-AC-11 | 3.1, 4.1 |
| F4-AC-12 | 4.1 |
| F5-AC-1 | 3.9 |
| F5-AC-2 | 2.9, 3.7, 3.9 |
| F5-AC-3 | 3.9 |
| F5-AC-4 | 2.9, 3.9 |
| F5-AC-5 | 3.12 |
| F5-AC-6 | 3.9 |
| F5-AC-7 | 3.12 |
| F6-AC-1 | 3.10, 3.12 |
| F6-AC-2 | 3.10 (exact match) |
| F6-AC-3 | 2.8 |
| F6-AC-4 | 2.8 |
| F6-AC-5 | 3.11, 4.2 |
| F6-AC-6 | 2.8, 3.10 |
| F6-AC-7 | 3.11 |
| F6-AC-8 | 3.12 |
| F6-AC-9 | 3.11 |
| F6-AC-10 | 2.8, 3.11 |
| F6-AC-11 | 3.10 |
| F6-AC-12 | 3.10 |
| F6-AC-13 | 3.10 |
| F6-AC-14 | 3.11 |
| F6-AC-15 | 3.11 |
| F7-AC-1 | 3.13 |
| F7-AC-2 | 2.9, 3.13 |
| F7-AC-3 | 3.13 |
| F7-AC-4 | 4.2 |
| F7-AC-5 | 2.9, 3.13 |
| F7-AC-6 | 2.6, 2.7, 3.13 |
| F7-AC-7 | 2.1, 4.3 |
| F7-AC-8 | 3.13 |
| F7-AC-9 | 3.13 |

**SPEC Common Principles 커버**: 템플릿 localStorage helper 경유는 2.5(어댑터 + 적합성 판정)와 4.3(정적 검사)이 담당합니다.

**SPEC 반영 대기 동작** (구현은 하되 DoD에 `[U-x]` 태그)

| 제안 | Tasks |
|---|---|
| U-4 기준일 62일 초과 시 일정 목록의 잔고 생략 | 2.9, 3.8, 3.13 |
| U-5 잔고 미표시 칸 탭 불가 | 2.9, 3.7 |

---

## Upstream 변경 요청 (PRD·SPEC — TASK만으로는 해결 불가)

교차 검증 갭 가운데 TASK를 바꿔서는 없앨 수 없는 것들입니다. 각 항목에 문제, 제안, TASK 영향을 적었습니다. 이 요청이 반영되기 전까지 구현은 **현재 SPEC**을 따릅니다.

| ID | 대상 | 문제 | 제안 | TASK 영향 |
|---|---|---|---|---|
| U-1 | PRD + PM | PRD는 "시뮬레이션은 리워드 광고 뒤"라고 합니다. SPEC F6-AC-13은 광고를 띄울 수 없으면(오프라인·슬롯 ID 없음·타임아웃) 무료로 엽니다. PRD의 광고 기반 MRR 추정에는 이 우회가 빠져 있습니다. | ① PRD 수익 추정에 "광고 실패 시 무료 열림" 비율 가정을 추가하거나, ② PM이 F6-AC-13 정책에 서명합니다. 우회 비율을 측정하려면 SPEC 계측 계약에 자동 열림 전용 노출 이름(예: `sim_locked_tier_fallback`)을 추가해야 합니다. 지금의 `sim_locked_tier`는 광고 완료와 자동 열림을 구분하지 못합니다. | 없음(3.10은 SPEC대로). SPEC에 로그 이름이 추가되면 3.10 DoD에 1줄 추가 |
| U-2 | PRD | PRD는 "자유롭게 추가·삭제"라고 하고, SPEC F3-AC-6은 30개 상한을 둡니다. | PRD에 "출금 항목 최대 30개(저장 용량·계산 성능 기준)"를 명시합니다. | 없음(3.6은 SPEC대로) |
| U-3 | SPEC 문장 | F1 `buildMonthEvents` 설명 마지막 문장("…actualDate > balanceAsOf인 날만 표시한다")이 이벤트 필터로 읽힙니다. | "잔고 **숫자**는 actualDate > balanceAsOf인 날만 표시한다. 항목 이름과 일정 행은 기준일 이전·당일에도 표시한다(F4-AC-3·F4-AC-10)."로 바꿉니다. | 없음(2.2·2.9 DoD로 이미 이 해석을 고정) |
| U-4 | SPEC 새 AC 제안 (F7-AC-10) | 기준일이 62일을 넘으면 F7-AC-5는 달력 잔고만 숨기고, 일정 목록에 대해서는 정하지 않았습니다. | "Given balanceHidden When 홈 진입 Then schedule-list 행 수는 유지되고, 보조 텍스트에 '잔고' 문자열이 0건이다" | 2.9·3.8의 `[U-4]` DoD. 반려되면 해당 DoD와 2.9 생략 규칙만 삭제 |
| U-5 | SPEC 새 AC 제안 (F4-AC-13) | F4-AC-4는 지난 날짜 칸을 탭했을 때의 동작을 정하지 않았습니다. 기준일 이전 날짜는 하루 마감 잔고를 계산하지 않으므로 상세 시트에 넣을 값이 없습니다. | "잔고 숫자가 표시되지 않는 칸은 탭해도 BottomSheet가 열리지 않고 `role=button`이 없다" | 2.9·3.7의 `[U-5]` DoD. 반려되면 시트 내용 정의가 필요 |
| U-6 | SPEC Common Principles (조건부) | 템플릿 helper가 예외를 삼키거나, 키에 접두사를 붙이거나, 원문을 바꾸면 F1-AC-7·9·10과 저장 형태 AC를 helper로 만족할 수 없습니다. | 2.5 적합성 판정이 실패할 때만 문구를 "저장소 접근은 `src/lib/store/storage.ts` 한 모듈로 제한하고, 이 모듈은 `window.localStorage`를 try/catch로 직접 쓴다"로 바꿉니다. | 2.5가 판정 실패로 차단되면, SPEC 변경 후 2.5의 어댑터 구현만 바꿉니다 |
| U-7 | PRD 목표 리스크 | 추천("26일로 옮기기")은 `weekendRule` 기본값 'none'과 검증되지 않은 은행 처리 규칙(OQ-1 주말, OQ-3 말일)에 기대고 있습니다. 실제 처리일이 다르면 추천이 틀릴 수 있습니다. | 출시 전 OQ-1·OQ-3을 확인합니다(카드사 회원약관, 은행 자동이체 약관). 확인 전에는 PRD 목표 문구에 "예상치"라고 적습니다. | 기본값을 `DEFAULT_WEEKEND_RULE`(2.1) 상수 하나로 모았습니다. OQ-1이 해결되면 이 한 줄만 바꾸고 3.3·3.5 테스트 기대값을 갱신합니다 |
| U-8 | PRD 목표 측정 | 목표 행동(은행·카드사에 출금일 변경 신청)은 앱 밖에서 일어납니다. 앱 안의 신호는 `sim_save_day` 클릭 하나뿐이라 목표 달성 여부를 검증할 수 없습니다. | PRD 성공 지표를 대리 지표로 다시 정의합니다. 예: ① `sim_save_day` 후 30일 안에 해당 항목의 출금일이 유지되는 비율, ② 다음 달 진입(F7-AC-1) 시 최저 잔고가 이전 달보다 개선된 사용자 비율. 이를 위해 SPEC 계측 계약에 새 로그 이름이 필요합니다(예: `outflow_day_edit`). | 현재 SPEC 계측 계약 밖이라 구현하지 않습니다. SPEC에 추가되면 3.6·3.13에 각각 태스크 1줄 추가 |
| U-9 | SPEC 명시 요청 (경미) | TASK에서 정한 세부 결정 3건: ① 합계 비율 `Math.round`(3.6), ② 비교 문구에서 delta 0은 `(0원)`, 음수는 `(-X원)`(3.11), ③ AdSlot에 노출 콜백이 없을 때 IntersectionObserver로 `banner_calendar`를 1회 기록(3.12). | SPEC 해당 AC에 그대로 반영합니다. | 없음 |