# SPEC 수정 요약: 저장 스키마 보완

지적된 저장 스키마 문제 3가지를 모두 반영했습니다. 기존 AC 번호는 그대로 두었고, 새 AC는 각 기능의 마지막 번호 뒤에 붙였습니다.

**1. `pcm.outflows.v1`의 버전 표시**
- 저장 값을 `{ version: 1, items: Outflow[] }`로 감쌌습니다. 이제 세 키 모두 값 안에 `version: 1`이 있습니다.
- 버전 없는 배열(`'[]'` 등)은 손상으로 처리합니다(F1-AC-6).
- 스키마 버전 규칙을 새로 정했습니다.
  - 모양이 바뀌면 키 접미사와 `version`을 함께 올립니다(`pcm.outflows.v2` + `version: 2`).
  - 새 버전 앱은 v1 키를 지우지 않습니다. 그래서 배포를 되돌려도 v1 앱은 자기 키를 그대로 읽습니다.

**2. 픽스처·기대값을 타입과 일치시킴**
- 새 필드를 추가하는 대신, 읽히지 않거나 다른 방법으로 대체되는 시각 필드를 뺐습니다.
  - `PaySettings.updatedAt`: 어디서도 읽지 않아 삭제했습니다.
  - `Outflow.createdAt`: 정렬 동률을 가리는 데만 쓰였습니다. `items` 배열 순서(등록 순)로 대체하고 삭제했습니다. 추가는 배열 끝에 붙이고, 수정은 제자리에서 바꿉니다.
- BASE 픽스처와 모든 기대값에 필요한 필드를 넣었습니다.
  - 설정에는 `version: 1`을 넣었습니다.
  - 출금 항목에는 고정 `id`(`o-rent` 등)와 `weekendRule`을 넣었습니다.
  - 해당 AC: F1-AC-3, F2-AC-1, F3-AC-1·2, F4-AC-10, F6-AC-5·6·10.
- `dayChange` 쓰기를 명시했습니다.
  - `applyDayChangeToItem`을 새로 두었습니다. 이 함수는 객체를 필드별로 새로 만들고, `dayChange`가 없으면 키 자체를 넣지 않습니다.
  - `{...item, ...result}` 병합은 금지했습니다.
  - 이 동작은 F1-AC-13으로 고정했습니다.

**3. 읽을 때의 검증 규칙과 버전 불일치 처리**
- 키별 검증 표를 Data Models에 추가했습니다. 정수 범위, `LocalDate`/`YearMonth` 형식, 실제 존재하는 날짜인지, id 중복, 30개 상한을 다룹니다.
- `version !== 1`(2 포함)은 손상으로 처리합니다.
- 해당 AC: F1-AC-11(설정), F1-AC-12(출금 항목), F7-AC-6(메타).
- 30개를 넘게 저장된 경우는 앞 30개만 남기고 다시 저장합니다.

---

# SPEC — Payday Crunch Map
앱 이름: 텅장달력 / Payday Crunch Map

## Value Contract
- 결과: 이 앱을 쓰고 나면 사용자는 이번 달과 다음 달 중 잔고가 가장 얇아지는 날과 그 금액을 안다. 그리고 어느 출금 항목을 며칠로 옮길지 정한다.
- 바뀌는 행동: 월급일 직전에 몰린 출금 하나(예: 24일 월세 자동이체)를 월급일 다음 날 이후로 바꿔 달라고 은행·카드사에 변경 신청한다.
- 매번 얻는 결과물: 날짜별 예상 잔고 달력과 '이번 달 최저 잔고일' 카드다.
  - 달력에는 사용자가 등록한 출금 항목이 자기 이름으로 찍힌다.
  - 카드에는 날짜, 최저 잔고 금액, 부족액, 월급 전 최저 구간이 나온다.
- 앱이 더하는 것:
  - ① 실제 처리 날짜 보정: 출금·입금일이 토·일이면 항목별 설정에 따라 직전 평일 또는 다음 평일로 옮긴다. 29~31일로 등록한 항목은 짧은 달의 말일로 보정한다.
    - 근거: 그레고리력의 요일과 월 길이.
    - 주말 처리 방향은 사용자가 고르며, 기본값의 출처는 미확정이다(OQ-1).
  - ② 같은 날 입금과 출금이 겹치면 출금이 먼저 나간다고 보고 '하루 중 최저 잔고'를 계산한다.
  - ③ 항목마다 1~28일을 모두 넣어 보고, 앞으로의 최저 잔고를 가장 많이 올리는 출금일과 그 증가액을 찾는다. 사용자가 손으로는 해 보지 않는 탐색이다.
  - 법령·공공 통계 같은 공개 기준 인용은 없다.
- 앱 없이: 은행 앱 자동이체 목록과 카드 결제일을 모아 메모장과 계산기로 날짜순 누적 잔고를 내면 항목 5개 기준 약 10분 걸린다. 출금일 이동 효과는 후보 날짜마다 다시 계산해야 해서 사실상 하지 않는다.
- Value AC: F4-AC-1

## Common Principles
- **기술 스택**
  - Vite + React + TypeScript, react-router-dom.
  - UI는 TDS(@toss/tds-mobile)만 쓴다: Top, ListRow, Button, TextField, Paragraph.Text, Chip+ChipItem, Badge, BottomSheet, AlertDialog, Toast, Tab, Spacing, Asset.ContentIcon.
  - 템플릿 컴포넌트를 함께 쓴다: ScreenScaffold/PageShell, SubmitFooter, FloatingTabBar, SummaryHero, CountUp, Sparkline, MiniBar, AdSlot, TossRewardAd.
- **스타일 규칙**
  - 여백은 TDS `Spacing`(size prop 필수)으로만 조절한다. TDS 컴포넌트의 padding·margin을 인라인 스타일이나 CSS로 덮어쓰지 않는다.
  - 커스텀 CSS는 달력 7열 grid와 flex 배치에만 쓴다.
  - 색상은 `var(--adaptive*)` 변수만 쓴다(예: `var(--adaptiveRed500)`, `var(--adaptiveGrey100)`). HEX 리터럴은 0개여야 한다.
- **저장소**
  - localStorage만 쓴다. 템플릿 localStorage helper를 거쳐 키 3개(`pcm.settings.v1`, `pcm.outflows.v1`, `pcm.meta.v1`)를 쓴다.
  - 세 키 모두 값 안에 `version: 1`을 둔다. 버전 규칙과 읽을 때의 검증 규칙은 Data Models의 '저장 스키마 공통 규칙'을 따른다.
  - 외부 API·서버는 없다.
  - 저장 실패는 `quota`와 `unknown` 모두 같은 Toast "저장하지 못했어요. 다시 시도해주세요"로 알린다. 화면과 입력값은 그대로 둔다.
  - localStorage에 접근할 수 없으면 모든 라우트에서 저장소 사용 불가 상태를 보여 준다(F4-AC-11). 저장하지 않고 쓰는 메모리 전용 모드는 없다.
- **라우팅**
  - 정의된 경로는 `/`, `/setup`, `/items` 3개다.
  - 그 밖의 경로(`/result` 포함)는 `<Route path="*" element={<Navigate to="/" replace />} />`로 홈에 보낸다(F4-AC-12).
  - 모든 라우트는 `StorageGuard`(F4-AC-11) 안에서 렌더된다.
- **입력 검증 공통 규칙**
  - 필수 TextField가 빈 값('')이면 제출 버튼은 `disabled`다. 키보드 Enter도 저장하지 않는다. 포커스를 벗어나면(blur) 필드 아래에 "~을 입력해주세요" 문구를 표시한다.
  - 값은 있지만 범위를 벗어나면 제출할 때 범위 안내 문구를 표시한다.
    - 0원: "0원보다 큰 금액을 입력해주세요"
    - 상한 초과: "~ 이하로 입력해주세요"
    - 날짜: "1~31 사이 날짜를 입력해주세요"
  - 숫자 필드는 `inputMode="numeric"`이며 숫자가 아닌 문자는 무시한다. 무시할 때 따로 안내 문구는 없다(음수 잔고는 OQ-4).
  - 저장하지 않은 입력(시트·폼)은 같은 세션에서 백그라운드에 갔다 돌아오면 유지된다. WebView가 새로 로드되면 사라진다.
- **인증**: Toss 세션이 자동으로 제공되므로 로그인 호출은 없다. 사용자 식별이 필요 없으므로 `getIsTossLoginIntegratedService()`도 호출하지 않는다.
- **날짜**
  - 모든 날짜는 로컬 기준 `'YYYY-MM-DD'` 문자열(`LocalDate`)이다. 요일은 `new Date(y, m - 1, d).getDay()`로 구한다.
  - `toISOString()`으로 날짜를 만들지 않는다(UTC 변환 시 하루 밀림).
  - 오늘 날짜는 `src/lib/date/getToday.ts`의 `getToday(): LocalDate`에서만 얻는다. 테스트는 이 함수를 mock한다.
- **금액**
  - 원 단위 정수다. 입력은 숫자만 받고 표시할 때 콤마를 넣는다(`2500000` → `2,500,000`).
  - 달력 칸 표시는 `formatCompactWon(n)` 규칙을 따른다.
    - |n| < 10,000이면 콤마 숫자 그대로(`9,800`).
    - 10,000 ≤ |n| < 100,000,000이면 n/10,000을 0 방향으로 소수 첫째 자리까지 자르고 "만"을 붙인다. ".0"은 지운다(`380000`→`38만`, `-252000`→`-25.2만`, `2248000`→`224.8만`).
    - |n| ≥ 100,000,000이면 같은 규칙으로 "억"을 붙인다(`123000000`→`1.2억`).
- **호환성(Android 7+, iOS 16+)**
  - `crypto.randomUUID`, `structuredClone`, `Array.prototype.at`, `Object.hasOwn`, `Intl.Segmenter`를 쓰지 않는다.
  - id는 `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`로 만든다.
- **검수 규칙**
  - 외부 URL 이동(`window.open`, `window.location.href = 'http…'`)은 0건이다.
  - 앱 설치 유도 문구('설치', '다운로드')는 0건이다.
  - 외부 분석 SDK(GA, Amplitude 등)는 0건이다.
  - 프로덕션 빌드에서 `console.error`는 0건이다.
- **계측**: 템플릿의 `logClick(name)`, `logImpression(name)`, `shareApp()`, `requestReviewOnce()`만 쓴다. 화면 진입·체류 로그는 PageShell이 자동으로 남기므로 따로 쓰지 않는다.
- **생성형 AI**: 사용하지 않으므로 AI 고지는 대상이 아니다.
- **프로모션 리워드**: `grantPromotionReward`는 사용하지 않는다(PRD 범위 밖).
- **API Contract**: 외부 API 호출이 없다. 모든 기능의 API는 "없음(localStorage)"이다. 따라서 HTTP 상태 코드 매핑도 없다.

## Data Models

### 공통 규칙 값
`WeekendRule`은 닫힌 집합인 처리 규칙이다. 사용자 분류가 아니다.
```ts
type WeekendRule = 'none' | 'prevBusinessDay' | 'nextBusinessDay';
// 'none' = 그대로, 'prevBusinessDay' = 직전 평일, 'nextBusinessDay' = 다음 평일
// 영업일 판정은 토·일만 제외 (공휴일 미반영 — OQ-2)
type LocalDate = string; // 'YYYY-MM-DD'
type YearMonth = string; // 'YYYY-MM'
```

### 저장 스키마 공통 규칙
- **버전 표시**: 세 키 모두 저장 값 안에 `version: 1`을 둔다. 키 이름의 `.v1`과 값의 `version`은 항상 같은 숫자다.
- **버전 올리는 규칙(향후)**
  - 저장 모양이 바뀌면 키 이름 접미사와 `version` 값을 함께 올린다(예: `pcm.outflows.v2` + `version: 2`).
  - 새 버전 앱은 새 키가 없을 때 이전 키를 읽어 변환한 뒤 새 키에 저장한다. 이전 키는 지우지 않는다. 배포를 되돌려도 이전 버전 앱이 자기 키를 그대로 읽게 하기 위해서다.
  - 이 변환은 v2 SPEC의 범위다. v1 앱은 `.v1` 키만 읽고 쓴다.
- **버전 불일치**
  - 위 규칙에 따라 `.v1` 키 안에 `version !== 1`인 값(누락, 문자열, 0, 2 이상 포함)은 정상 경로로는 생기지 않는다. 그래서 손상과 같게 처리한다.
  - 처리 방식은 아래 키별 표의 '컨테이너 실패' 처리를 따른다.
- **공통 판정식**
  - 일반 객체: `typeof v === 'object' && v !== null && !Array.isArray(v)`
  - 정수: `Number.isInteger(v)`. 문자열 숫자(`"25"`)는 실패다.
  - LocalDate: `/^\d{4}-\d{2}-\d{2}$/`에 맞고, `new Date(y, m - 1, d)`의 연·월·일이 입력과 같아야 한다(`'2026-02-30'`은 실패).
  - YearMonth: `/^\d{4}-(0[1-9]|1[0-2])$/`
- **정규화**
  - load 결과 객체에는 아래 타입에 정의된 키만 넣는다.
  - 정의되지 않은 추가 필드(예: 이전 개발 빌드가 남긴 `updatedAt`·`createdAt`)는 무시한다. 추가 필드만으로는 손상으로 보지 않고 키를 다시 쓰지도 않는다. 다음 save 때 정규화된 값으로 덮어써진다.
  - 선택 필드(`dayChange`)가 없으면 결과 객체에 키 자체가 없다. `dayChange: undefined`처럼 값만 비운 키를 만들지 않는다.
- **save 계열**: 타입에 정의된 필드만 직렬화한다. 검증은 하지 않는다. 범위·개수 제한은 호출하는 UI가 지킨다(F2·F3 입력 검증, F3-AC-6).

### PaySettings — 월급·잔고 설정
- 키: `pcm.settings.v1`
- 저장 값: `PaySettings` 객체 하나
- 크기: 약 200B
```ts
interface PaySettings {
  version: 1;
  salaryAmount: number;          // 정수, 1 ~ 1,000,000,000
  salaryDay: number;             // 정수, 1 ~ 31
  salaryWeekendRule: WeekendRule;// 기본 'none'
  currentBalance: number;        // 정수, 0 ~ 9,999,999,999 (오늘 입출금이 반영된 잔고)
  balanceAsOf: LocalDate;        // 잔고 기준일 — 이 날의 이벤트는 이미 반영된 것으로 보고 투영에서 제외
}
```

**읽을 때 검증(loadSettings)**: 아래 조건을 모두 통과해야 유효하다.

| 필드 | 통과 조건 |
|---|---|
| (값 전체) | JSON 파싱 성공 + 일반 객체 |
| `version` | `=== 1` |
| `salaryAmount` | 정수, 1 ≤ x ≤ 1,000,000,000 |
| `salaryDay` | 정수, 1 ≤ x ≤ 31 |
| `salaryWeekendRule` | `'none'`·`'prevBusinessDay'`·`'nextBusinessDay'` 중 하나 |
| `currentBalance` | 정수, 0 ≤ x ≤ 9,999,999,999 |
| `balanceAsOf` | LocalDate 판정 통과 |

- 하나라도 실패하면 키를 삭제하고 `{ settings: null, recovered: true }`를 돌려준다. 부분 복구는 하지 않는다.
- 통과하면 위 6개 키만 가진 객체를 `{ settings, recovered: false }`로 돌려준다.

### Outflow — 사용자 등록 출금 항목
- 키: `pcm.outflows.v1`
- 저장 값: `OutflowStore` 객체. 배열을 바로 저장하지 않는다.
- 최대 30개
- 크기: 30 × 약 180B + 래퍼 ≈ 6KB
```ts
interface OutflowStore {
  version: 1;
  items: Outflow[];              // 배열 순서 = 등록 순서. 추가는 끝에 붙이고, 수정은 같은 위치에서 교체, 삭제는 제거. 저장 시 재정렬하지 않는다.
}
interface Outflow {
  id: string;                    // Common Principles의 id 생성 규칙, 1 ~ 32자
  name: string;                  // trim 후 1 ~ 20자, 중복 허용 (입력 시 trim해서 저장)
  amount: number;                // 정수, 1 ~ 100,000,000
  day: number;                   // 정수, 1 ~ 31 (짧은 달은 말일 보정)
  weekendRule: WeekendRule;      // 기본 'none'
  dayChange?: {                  // 이번 달 출금이 이미 지났거나 새 날짜가 이미 지난 경우의 적용 시점. 없으면 키 자체가 없다.
    fromDay: number;             // 정수, 1 ~ 31. effectiveMonth 이전 달에 쓰는 원래 날짜
    effectiveMonth: YearMonth;   // 이 달부터 day 적용
  };
}
```
- 카테고리 유니온은 없다. 이름 프리셋('월세', '카드값', '통신비', '보험료', '구독료')은 입력 시트의 ChipItem 제안일 뿐이다. 저장되는 타입이 아니다.
- 금액을 지어내지 않도록 프리셋 항목을 미리 넣어 두지 않는다.
- 같은 날 출금끼리의 순서(정렬 동률)는 `items` 배열 순서(등록 순)로 정한다. 별도 시각 필드는 두지 않는다.

**읽을 때 검증(loadOutflows)**

**① 컨테이너**: 아래 조건을 모두 통과해야 한다.
- JSON 파싱 성공
- 일반 객체
- `version === 1`
- `Array.isArray(items)`

실패하면 키를 삭제하고 `{ items: [], recovered: true }`를 돌려준다. 버전 없는 배열(`'[]'`, `'[{…}]'`)도 실패다.

**② 항목**: 각 항목은 아래 조건을 모두 통과해야 한다.

| 필드 | 통과 조건 |
|---|---|
| (항목 전체) | 일반 객체 |
| `id` | 문자열, 길이 1 ~ 32, 앞서 통과한 항목과 중복 아님 |
| `name` | 문자열, `trim()` 길이 1 ~ 20 |
| `amount` | 정수, 1 ≤ x ≤ 100,000,000 |
| `day` | 정수, 1 ≤ x ≤ 31 |
| `weekendRule` | 세 값 중 하나 |
| `dayChange` | 키가 없으면 통과. 있으면 일반 객체 + `fromDay` 정수 1 ~ 31 + `effectiveMonth` YearMonth 판정 통과 |

- 실패한 항목만 걸러 낸다. `dayChange`가 잘못된 항목도 항목 전체를 걸러 낸다. 날짜 계산이 조용히 달라지는 것을 막기 위해서다.
- `effectiveMonth`가 이미 지난 `dayChange`는 유효하다. 계산 함수가 처리한다.

**③ 개수 상한**: 통과한 항목이 30개를 넘으면 배열 앞(먼저 등록한 것)부터 30개만 남긴다.

**결과**
- ②나 ③으로 하나라도 걸러 냈으면 `{ version: 1, items: 남은 항목 }`으로 키를 다시 저장하고 `{ items: 남은 항목, recovered: true }`를 돌려준다.
- 다시 저장이 실패해도 예외 없이 같은 값을 돌려준다. 이 경우 다음 load에서 다시 걸러 내므로 recovered가 다시 true가 될 수 있으며, 이는 허용한다.
- 걸러 낸 것이 없으면 키를 다시 쓰지 않고 `{ items, recovered: false }`를 돌려준다.

### AppMeta — 앱 상태
- 키: `pcm.meta.v1`
- 저장 값: `AppMeta` 객체 하나
- 크기: 약 50B
```ts
interface AppMeta {
  version: 1;
  lastSeenMonth: YearMonth | null; // 마지막으로 홈을 본 달
}
```

**읽을 때 검증(loadMeta)**: 아래 조건을 모두 통과해야 유효하다.
- JSON 파싱 성공
- 일반 객체
- `version === 1`
- `lastSeenMonth`가 `null`이거나 YearMonth 판정 통과

실패하면 `null`을 돌려준다. 키는 지우지 않는다. 홈이 곧바로 현재 달로 덮어쓰기 때문이다(F7-AC-6).

### 파생 타입 (저장하지 않음, 계산 엔진 출력)
```ts
interface DayEvent {
  kind: 'salary' | 'outflow';
  refId: string | null;          // outflow.id, salary는 null
  name: string;                  // outflow.name 또는 '월급'
  amount: number;                // 양수
  scheduledDay: number;          // 등록한 날짜
  actualDate: LocalDate;         // 말일·주말 보정 후 날짜
  shifted: boolean;              // 보정으로 날짜가 바뀌었는지
}
interface DayBalance {
  date: LocalDate;
  events: DayEvent[];
  lowBalance: number;            // 시작잔고 − 그날 출금 합 (입금 전)
  endBalance: number;            // lowBalance + 그날 월급
}
interface MonthSummary {
  month: YearMonth;
  lowest: { date: LocalDate; balance: number } | null;  // 범위 내 lowBalance 최소, 동률이면 가장 이른 날
  crunch: { start: LocalDate; end: LocalDate; days: number } | null;
  firstNegativeDate: LocalDate | null;                  // 범위 내 lowBalance < 0인 첫 날
}
interface SimResult {
  itemId: string;
  name: string;
  fromDay: number;
  toDay: number;
  baseMin: number;               // 변경 전 시뮬레이션 구간 최저 잔고
  newMin: number;                // 변경 후
  delta: number;                 // newMin − baseMin
  improved: boolean;             // delta > 0
}
```

### 총 용량
약 6.3KB로 10KB 미만이며 5MB 한도와 거리가 멀다.

## Feature List

### F1. 잔고 계산 엔진 & 저장소 (데이터 계층)
- **Description**
  - 설정과 출금 항목으로 날짜별 예상 잔고를 투영하고, 월별 최저 잔고일·월급 전 최저 구간·마이너스 시작일을 계산하는 순수 함수 모듈이다.
  - localStorage 읽기·쓰기, 읽을 때의 스키마 검증, 손상 데이터 복구, 저장소 접근 가능 여부 확인을 맡는다.
  - UI는 없고 모든 화면이 이 모듈만 거친다.
- **Data**: PaySettings, OutflowStore/Outflow, AppMeta, DayBalance, MonthSummary
- **API**: 없음(localStorage)
- **모듈** (`src/lib/balance/`, `src/lib/store/`)
  - `resolveActualDate(year: number, month: number, day: number, rule: WeekendRule): LocalDate`
    - 먼저 day를 그 달 말일로 보정한다. 그다음 토·일이면 rule에 따라 직전 평일 또는 다음 평일로 옮긴다. 달 경계를 넘을 수 있다.
  - `buildProjection(args: { settings: PaySettings; outflows: Outflow[]; today: LocalDate; endDate: LocalDate; override?: { itemId: string; toDay: number } }): DayBalance[]`
    - 범위: balanceAsOf부터 endDate까지 하루씩 만든다.
    - balanceAsOf 당일은 이벤트 없이 low = end = currentBalance다.
    - 이벤트: month(asOf)−1부터 month(endDate)+1까지 각 달의 이벤트를 만들고 actualDate가 (asOf, endDate]에 드는 것만 반영한다.
    - 같은 날에는 출금을 먼저 반영하고 월급을 나중에 반영한다.
    - 출금 날짜: `dayChange`가 있으면 effectiveMonth 이상인 달은 day, 미만인 달은 fromDay를 쓴다.
    - 이 함수는 잔고 계산에만 쓴다. (asOf, endDate] 밖의 이벤트는 잔고 계산에서만 빠진다. 화면에 항목 이름을 표시할지는 이 함수가 아니라 아래 `buildMonthEvents`가 정한다.
  - `buildMonthEvents(args: { settings: PaySettings; outflows: Outflow[]; month: YearMonth }): DayEvent[]`
    - 그 달에 actualDate가 드는 이벤트를 모두 돌려준다. 월급을 포함하고, balanceAsOf 이전·당일 이벤트도 포함한다.
    - 날짜 규칙은 buildProjection과 같다: 말일·주말 보정, dayChange.
    - 정렬: actualDate 오름차순이다. 같은 날이면 출금을 먼저, 출금끼리는 `outflows` 배열 순서(등록 순)로 둔다.
    - `schedule-list` 행과 달력 칸의 항목 이름은 이 목록으로 만든다. 잔고 숫자만 DayBalance에서 가져오며, actualDate > balanceAsOf인 날만 표시한다.
  - `summarizeMonth(days: DayBalance[], month: YearMonth, today: LocalDate): MonthSummary`
    - 판단 범위: 이번 달이면 max(today, balanceAsOf, 월초)부터 월말까지, 그 외 달은 월 전체다.
    - crunch.start는 lowest.date다.
    - crunch.end는 lowest.date 이후 첫 월급 actualDate의 전날이다. 단, 그 날이 월말보다 늦으면 월말로 자른다.
    - lowest.date에 월급 이벤트가 있으면 crunch는 그 하루다.
  - `formatCompactWon(n: number): string`
  - `applyDayChange(item: Pick<Outflow,'name'|'day'|'dayChange'>, newDay: number, today: LocalDate): { day: number; dayChange?: Outflow['dayChange'] }`
    - 이번 달 = month(today), 다음 달 = 이번 달 + 1이다.
    - 이번 달 기준 날짜 curDay를 정한다.
      - 기존 `dayChange`가 있고 effectiveMonth > 이번 달(아직 적용 전)이면 curDay = 기존 fromDay다.
      - 그 외에는 curDay = item.day다. effectiveMonth ≤ 이번 달인 기존 dayChange는 이미 적용됐으므로 버린다.
    - newDay === curDay면 `{ day: newDay }`를 돌려주고 dayChange는 없다.
    - 날짜 비교는 `resolveActualDate(이번 달, curDay 또는 newDay, 'none')`(말일 보정만 적용)으로 한다.
    - curDay 날짜 ≤ today 또는 newDay 날짜 ≤ today이면 `{ day: newDay, dayChange: { fromDay: curDay, effectiveMonth: 다음 달 } }`을 돌려준다. 기존 dayChange는 이 값으로 교체된다.
    - 두 날짜가 모두 today보다 뒤면 `{ day: newDay }`를 돌려주고 dayChange는 없다(기존 dayChange 제거).
    - 반환 객체에 `dayChange` 키가 없다는 것이 곧 "dayChange 제거"를 뜻한다. `dayChange: undefined` 키를 만들지 않는다.
    - 순수 함수이며 저장은 호출한 쪽이 한다.
  - `applyDayChangeToItem(item: Outflow, newDay: number, today: LocalDate): Outflow`
    - `applyDayChange` 결과로 저장할 항목 객체를 만든다.
    - `{ id: item.id, name: item.name, amount: item.amount, weekendRule: item.weekendRule, day: r.day }`를 필드별로 새로 만든다. `r.dayChange`가 있을 때만 `dayChange` 키를 추가한다.
    - `{ ...item, ...r }` 같은 spread 병합은 금지다. 기존 `dayChange`가 남기 때문이다.
    - F3 항목 수정과 F6 '이 날짜로 저장'은 날짜가 바뀌지 않아도 반드시 이 함수로 항목을 만든다. 이름·금액·주말 처리 변경은 이 함수 결과에 덮어써서 반영한다.
  - `probeStorage(): boolean`
    - `window.localStorage` 접근과 `localStorage.getItem('pcm.settings.v1')` 호출을 try/catch로 감싸 실행한다. 예외가 없으면 true, 있으면 false다.
    - 쓰기는 시도하지 않는다. 쓰기 실패(저장 공간 부족 등)는 save 계열의 반환값으로 다룬다.
  - `loadSettings / saveSettings / loadOutflows / saveOutflows / loadMeta / saveMeta`
    - 직렬화 형태는 다음과 같다.
      - `saveSettings(s: PaySettings)`는 `{ version: 1, salaryAmount, salaryDay, salaryWeekendRule, currentBalance, balanceAsOf }` 6개 키만 저장한다.
      - `saveOutflows(items: Outflow[])`는 `{ version: 1, items }`로 감싸 저장한다.
      - `saveMeta(m: AppMeta)`는 `{ version: 1, lastSeenMonth }`를 저장한다.
    - save 계열은 `{ ok: true } | { ok: false; error: 'quota' | 'unknown' }`를 돌려준다.
      - 예외의 `name`이 `'QuotaExceededError'` 또는 `'NS_ERROR_DOM_QUOTA_REACHED'`이거나 `code`가 22 또는 1014이면 `'quota'`다.
      - 그 밖의 예외는 모두 `'unknown'`이다.
      - save 계열은 예외를 밖으로 던지지 않는다.
    - load 계열은 Data Models의 키별 '읽을 때 검증' 규칙을 따른다.
    - load 계열은 예외를 밖으로 던지지 않는다. localStorage 접근 자체가 예외를 던지면 '키 없음'과 같은 값을 돌려주고 아무 키도 지우거나 쓰지 않는다.
    - `loadOutflows()`는 `{ items: Outflow[]; recovered: boolean }`을 돌려준다.
      - `recovered`는 컨테이너 손상으로 키를 지웠거나, 항목을 하나 이상 걸러 냈거나 잘라 냈을 때 true다.
      - 키가 없으면 `{ items: [], recovered: false }`다.
    - `loadSettings()`는 `{ settings: PaySettings | null; recovered: boolean }`을 돌려준다.
      - `recovered`는 손상(파싱 실패, 버전 불일치, 필드 검증 실패)으로 키를 지웠을 때만 true다.
      - 키가 없으면 `{ settings: null, recovered: false }`다.
    - `loadMeta()`는 `AppMeta | null`을 돌려준다. 키가 없거나 검증에 실패하면 null이다.
- **공통 테스트 픽스처 'BASE'**
  - settings: `{ version: 1, salaryAmount: 2500000, salaryDay: 25, salaryWeekendRule: 'none', currentBalance: 800000, balanceAsOf: '2026-10-11' }`
  - outflows(배열 순서 = 등록 순서):
    ```ts
    [
      { id: 'o-rent',    name: '월세',     amount: 550000, day: 24, weekendRule: 'none' },
      { id: 'o-card',    name: '카드값',   amount: 420000, day: 14, weekendRule: 'none' },
      { id: 'o-phone',   name: '통신비',   amount: 65000,  day: 21, weekendRule: 'none' },
      { id: 'o-netflix', name: '넷플릭스', amount: 17000,  day: 18, weekendRule: 'none' },
    ]
    ```
  - 저장 형태: `pcm.settings.v1 = JSON.stringify(BASE.settings)`, `pcm.outflows.v1 = JSON.stringify({ version: 1, items: BASE.outflows })`
  - today는 `'2026-10-11'`(일요일)이다.
- **Requirements**
- AC-1 [U][P0]: Scenario: 기본 잔고 투영과 월 요약
  - Given 픽스처 BASE
  - When `buildProjection({ ..., endDate: '2026-11-30' })` 후 `summarizeMonth(days, '2026-10', '2026-10-11')`를 호출
  - Then 날짜별 endBalance가 다음과 같다.
    - 10-14: 380,000
    - 10-18: 363,000
    - 10-21: 298,000
    - 10-24: -252,000
    - 10-25: 2,248,000
    - 11-24: 1,196,000
    - 11-25: 3,696,000
  - And 반환값은 `lowest = { date: '2026-10-24', balance: -252000 }`, `crunch = { start: '2026-10-24', end: '2026-10-24', days: 1 }`, `firstNegativeDate = '2026-10-24'`이다.
- AC-2 [U][P0]: Scenario: 주말·말일 날짜 보정
  - Given 2026-10-24는 토요일, 2026-10-25는 일요일이다.
  - When resolveActualDate를 호출하면
  - Then 결과는 다음과 같다.
    - `(2026, 10, 25, 'prevBusinessDay')` → `'2026-10-23'`
    - `(2026, 10, 24, 'nextBusinessDay')` → `'2026-10-26'`
    - `(2026, 11, 31, 'none')` → `'2026-11-30'`
    - `(2027, 2, 31, 'none')` → `'2027-02-28'`
  - And BASE에서 salaryWeekendRule을 'prevBusinessDay'로, 월세(`o-rent`) weekendRule을 'nextBusinessDay'로 바꾸면 `summarizeMonth(..., '2026-10', ...)`는 `lowest = { date: '2026-10-21', balance: 298000 }`, `crunch = { start: '2026-10-21', end: '2026-10-22', days: 2 }`, `firstNegativeDate = null`이다.
  - And 이때 DayEvent '월세'는 `refId: 'o-rent', shifted: true, actualDate: '2026-10-26'`이다.
- AC-3 [U][P0]: Scenario: 같은 날 출금이 월급보다 먼저 나간다
  - Given settings `{ ...BASE.settings, currentBalance: 100000 }`와 outflows `[{ id: 'o-save', name: '적금이체', amount: 300000, day: 25, weekendRule: 'none' }]`
  - When 투영과 10월 요약을 계산
  - Then 10-25의 `lowBalance = -200000`, `endBalance = 2300000`이다.
  - And `lowest = { date: '2026-10-25', balance: -200000 }`, `crunch = { start: '2026-10-25', end: '2026-10-25', days: 1 }`이다.
- AC-4 [E][P0]: Scenario: 저장·불러오기 왕복
  - Given 빈 localStorage
  - When `saveSettings(BASE.settings)`와 `saveOutflows(BASE.outflows)`를 호출한 뒤 load를 호출
  - Then 두 save는 `{ ok: true }`를 돌려준다.
  - And `JSON.parse(localStorage['pcm.settings.v1'])`는 `BASE.settings`와 deep-equal이다(키 6개).
  - And `JSON.parse(localStorage['pcm.outflows.v1'])`는 `{ version: 1, items: BASE.outflows }`와 deep-equal이다.
  - And `loadSettings()`는 `{ settings: BASE.settings, recovered: false }`, `loadOutflows()`는 `{ items: BASE.outflows, recovered: false }`와 deep-equal이다.
  - And 항목 순서와 이름이 '월세', '카드값', '통신비', '넷플릭스'로 유지되고, 어느 항목에도 `dayChange` 키가 없다.
- AC-5 [U][P0]: Scenario: 출금일 변경 적용 시점(applyDayChange)
  - Given today `'2026-10-11'`
  - When 다음 세 경우를 각각 호출
    - `applyDayChange({ name: '카드값', day: 10 }, 26, today)` — 10-10은 이미 지남
    - `applyDayChange({ name: '월세', day: 24 }, 5, today)` — 새 날짜 10-05가 이미 지남
    - `applyDayChange({ name: '월세', day: 24 }, 26, today)` — 두 날짜 모두 오늘 이후
  - Then 결과는 다음과 같다.
    - 첫째: `{ day: 26, dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`
    - 둘째: `{ day: 5, dayChange: { fromDay: 24, effectiveMonth: '2026-11' } }`
    - 셋째: `{ day: 26 }`이며 `'dayChange' in result === false`다.
  - And 첫째 결과로 asOf 10-11부터 투영하면 10월에는 카드값 이벤트가 없고 11-26에 카드값 이벤트가 있다.
  - And 기존 dayChange `{ fromDay: 10, effectiveMonth: '2026-11' }`이 있는 `{ name: '카드값', day: 26 }`에 `applyDayChange(..., 27, today)`를 호출하면 결과는 `{ day: 27, dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`이다. 기존 fromDay가 유지된다.
- AC-6 [W][P1]: Scenario: 손상된 저장 데이터
  - Given `localStorage['pcm.settings.v1'] = '{bad'` 또는 `'{"version":1,"salaryDay":"x"}'`
  - When `loadSettings()`를 호출
  - Then 예외 없이 `{ settings: null, recovered: true }`를 돌려주고 해당 키를 삭제한다. `console.error` 호출은 0회다.
  - And `pcm.settings.v1` 키가 없으면 `loadSettings()`는 `{ settings: null, recovered: false }`를 돌려준다.
  - And `pcm.outflows.v1`이 다음 중 하나면 `loadOutflows()`는 예외 없이 `{ items: [], recovered: true }`를 돌려주고 해당 키를 삭제한다.
    - 파싱할 수 없는 값: `'{bad'`
    - 컨테이너 형태가 아닌 값: `'{"a":1}'`, 버전 없는 배열 `'[]'`, `JSON.stringify(BASE.outflows)`
  - And `pcm.outflows.v1 = { version: 1, items: BASE.outflows }`에서 '넷플릭스'만 `amount: -5`이면 다음과 같다.
    - 그 항목만 걸러 내고 `{ items: [월세, 카드값, 통신비], recovered: true }`를 돌려준다. 순서는 유지된다.
    - 키는 `{ version: 1, items: [월세, 카드값, 통신비] }`로 다시 저장되어, 다음 호출의 recovered는 false다.
  - And 위 경우 모두 `console.error` 호출은 0회다.
- AC-7 [W][P1]: Scenario: 저장 용량 초과
  - Given `localStorage.setItem`이 `QuotaExceededError`를 던지도록 mock됨
  - When `saveOutflows([...])`를 호출
  - Then `{ ok: false, error: 'quota' }`를 돌려준다.
  - And 기존 `pcm.outflows.v1` 값이 바뀌지 않는다.
- AC-8 [U][P1]: Scenario: 출금 0개(빈 상태) 계산
  - Given BASE.settings와 outflows `[]`
  - When 10월 요약을 계산
  - Then `lowest = { date: '2026-10-11', balance: 800000 }`, `crunch = { start: '2026-10-11', end: '2026-10-24', days: 14 }`, `firstNegativeDate = null`이다.
  - And 10-25 endBalance는 3,300,000이며, 예외 없이 계산된다.
- AC-9 [W][P1]: Scenario: 용량 초과가 아닌 저장 실패(unknown)
  - Given `localStorage.setItem`이 `new DOMException('denied', 'SecurityError')` 또는 `new Error('x')`를 던지도록 mock됨
  - When `saveSettings(BASE.settings)`, `saveOutflows(BASE.outflows)`, `saveMeta({ version: 1, lastSeenMonth: '2026-10' })`를 각각 호출
  - Then 셋 모두 예외 없이 `{ ok: false, error: 'unknown' }`을 돌려준다.
  - And 기존 세 키의 값은 바뀌지 않는다.
  - And `setItem`이 `name: 'NS_ERROR_DOM_QUOTA_REACHED'` 또는 `code: 22` 예외를 던지면 `{ ok: false, error: 'quota' }`를 돌려준다.
  - And `console.error` 호출은 0회다.
- AC-10 [W][P1]: Scenario: localStorage 접근 자체가 막힘
  - Given `window.localStorage` getter가 `SecurityError`를 던지거나, `localStorage.getItem`이 예외를 던지도록 mock됨
  - When `probeStorage()`, `loadSettings()`, `loadOutflows()`, `loadMeta()`를 호출
  - Then `probeStorage()`는 false다.
  - And `loadSettings()`는 `{ settings: null, recovered: false }`, `loadOutflows()`는 `{ items: [], recovered: false }`, `loadMeta()`는 null을 돌려주고, 예외를 던지지 않는다.
  - And `localStorage.removeItem`과 `localStorage.setItem` 호출은 모두 0회다.
  - And mock을 해제하면 `probeStorage()`는 true다.
  - And `console.error` 호출은 0회다.
- AC-11 [W][P1]: Scenario: 설정 키의 필드·버전 검증
  - Given `pcm.settings.v1`에 아래 값 중 하나가 저장됨. 표기는 BASE.settings에서 해당 필드만 바꾼 값이다.
    - `version: 2`
    - `version` 키 없음
    - `version: "1"`
    - `salaryAmount: 0`
    - `salaryAmount: 1000000001`
    - `salaryDay: 0`
    - `salaryDay: 32`
    - `salaryDay: 2.5`
    - `salaryDay: "25"`
    - `salaryWeekendRule: 'weekend'`
    - `currentBalance: -1`
    - `currentBalance: 10000000000`
    - `balanceAsOf: '2026-02-30'`
    - `balanceAsOf: '2026/10/11'`
    - 값 전체가 `'null'`
    - 값 전체가 `'[]'`
  - When `loadSettings()`를 호출
  - Then 각 경우 모두 예외 없이 `{ settings: null, recovered: true }`를 돌려주고 `pcm.settings.v1` 키를 삭제한다.
  - And 경계값 `salaryAmount: 1000000000`, `salaryDay: 31`, `currentBalance: 0`, `currentBalance: 9999999999`는 각각 유효해서 `recovered: false`로 불러온다.
  - And `{ ...BASE.settings, updatedAt: '2026-10-11T00:00:00Z' }`처럼 정의되지 않은 키가 있으면 `{ settings: BASE.settings, recovered: false }`를 돌려준다. 결과 객체에는 `updatedAt` 키가 없고 저장된 원문도 바뀌지 않는다.
  - And `console.error` 호출은 0회다.
- AC-12 [W][P1]: Scenario: 출금 항목 키의 버전·항목 검증과 30개 상한
  - Given `pcm.outflows.v1`에 아래 값 중 하나가 저장됨. 각 경우의 기대 결과는 다음과 같다.
    - `{ version: 2, items: BASE.outflows }`
      - 결과: `{ items: [], recovered: true }`, 키 삭제
    - `{ version: 1, items: { } }`
      - 결과: `{ items: [], recovered: true }`, 키 삭제
    - `{ version: 1, items: BASE.outflows + 다섯째 항목 }` (다섯째는 `{ id: 'o-rent', name: '중복', amount: 1000, day: 3, weekendRule: 'none' }`, id 중복)
      - 결과: BASE 4개, `recovered: true`. 먼저 나온 'o-rent'(월세)를 남긴다.
    - `{ version: 1, items: [ { ...월세, dayChange: { fromDay: 40, effectiveMonth: '2026-11' } }, 카드값 ] }`
      - 결과: `[카드값]`, `recovered: true`
    - `{ version: 1, items: [ { ...월세, dayChange: { fromDay: 10, effectiveMonth: '2026-13' } }, 카드값 ] }`
      - 결과: `[카드값]`, `recovered: true`
    - `{ version: 1, items: [ { ...월세, name: '   ' }, { ...카드값, name: '가'.repeat(21) }, 통신비 ] }`
      - 결과: `[통신비]`, `recovered: true`
    - `{ version: 1, items: [ { ...월세, weekendRule: 'weekend' }, 카드값 ] }`
      - 결과: `[카드값]`, `recovered: true`
    - 유효한 항목 31개(id `'o-1'` ~ `'o-31'`, 배열 순서대로)
      - 결과: `'o-1'` ~ `'o-30'` 30개, `recovered: true`
    - 모든 항목이 검증 실패
      - 결과: `{ items: [], recovered: true }`
  - When `loadOutflows()`를 호출
  - Then 결과가 각각 위와 같다.
  - And 걸러 내거나 잘라 낸 경우에는 키가 `{ version: 1, items: 결과 }`로 다시 저장되고, 다음 `loadOutflows()`의 recovered는 false다.
  - And 다시 저장할 때 `setItem`이 `QuotaExceededError`를 던지도록 mock하면 다음과 같다.
    - 예외 없이 같은 items와 `recovered: true`를 돌려준다.
    - 저장된 원문은 바뀌지 않는다.
  - And `{ version: 1, items: [ { ...월세, createdAt: '2026-10-01T00:00:00Z' } ] }`는 `{ items: [월세], recovered: false }`를 돌려준다. 결과 객체에 `createdAt` 키가 없고 키를 다시 쓰지 않는다.
  - And `effectiveMonth: '2026-09'`처럼 이미 지난 dayChange는 유효하므로 걸러 내지 않는다.
  - And `console.error` 호출은 0회다.
- AC-13 [U][P0]: Scenario: dayChange 제거가 저장 값에 반영된다
  - Given 저장된 카드값 `{ id: 'o-card', name: '카드값', amount: 420000, day: 26, weekendRule: 'none', dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`
  - When 다음 두 경우를 각각 호출
    - `applyDayChangeToItem(카드값, 27, '2026-11-02')` — effectiveMonth ≤ 이번 달이라 기존 dayChange는 버려지고, 11-26·11-27 모두 오늘 이후
    - `applyDayChangeToItem(카드값, 10, '2026-10-11')` — newDay가 아직 적용 전인 fromDay 10과 같음(변경 취소)
  - Then 결과는 각각 다음과 같다.
    - `{ id: 'o-card', name: '카드값', amount: 420000, day: 27, weekendRule: 'none' }`
    - `{ id: 'o-card', name: '카드값', amount: 420000, day: 10, weekendRule: 'none' }`
  - And 두 결과 모두 `'dayChange' in result === false`다.
  - And 결과를 `saveOutflows`로 저장하면 `localStorage['pcm.outflows.v1']` 문자열에 `"dayChange"`가 포함되지 않는다.
  - And 날짜를 바꾸지 않고 `applyDayChangeToItem(카드값, 26, '2026-10-11')`을 호출하면 `dayChange: { fromDay: 10, effectiveMonth: '2026-11' }`이 그대로 남는다. curDay가 10이고 10-10이 이미 지났기 때문이다.
  - And `applyDayChangeToItem`의 반환 객체 키는 `id`, `name`, `amount`, `weekendRule`, `day`이며, `dayChange`는 있을 때만 추가된다.

### F2. 월급·잔고 설정 화면 (`/setup`)
- **Description**
  - 월급 실수령액, 월급일, 월급일이 주말일 때의 처리, 현재 잔고를 입력한다.
  - 첫 실행(onboarding)과 수정(edit)에 같은 화면을 쓴다. 이월 시 잔고를 다시 입력하는 화면이기도 하다.
  - 잔고 기준일은 잔고 값을 바꿨을 때만 오늘로 갱신된다.
- **Data**: PaySettings
- **API**: 없음(localStorage)
- **Requirements**
- AC-1 [E][P0]: Scenario: 첫 설정 저장
  - Given 저장된 설정이 없고 today가 '2026-10-11'이며 `location.state = { mode: 'onboarding' }`
  - When `{ salaryAmount: '2,500,000', salaryDay: '25', 주말이면: '그대로', currentBalance: '800,000' }`을 입력하고 SubmitFooter '다음'을 탭
  - Then `JSON.parse(localStorage['pcm.settings.v1'])`가 `{ version: 1, salaryAmount: 2500000, salaryDay: 25, salaryWeekendRule: 'none', currentBalance: 800000, balanceAsOf: '2026-10-11' }`과 deep-equal이다(키 6개, BASE.settings와 같음).
  - And `logClick('setup_save')`가 1회 호출되고, `navigate('/items', { state: { from: 'onboarding' } })`로 이동한다.
- AC-2 [E][P0]: Scenario: 잔고를 건드리지 않은 수정은 기준일을 유지
  - Given 저장값이 BASE.settings이고 today가 '2026-10-20'이며 `location.state = { mode: 'edit' }`
  - When 월급 실수령액만 '2,700,000'으로 바꾸고 '저장'을 탭
  - Then `{ ...BASE.settings, salaryAmount: 2700000 }`으로 저장된다. `version`은 1, `balanceAsOf`는 '2026-10-11'로 유지된다.
  - And Toast "저장했어요"를 표시하고 `navigate('/', { replace: true })`로 이동한다.
  - And 잔고 입력란 값을 '1,000,000'으로 바꿔 저장하면 `currentBalance = 1000000`, `balanceAsOf = '2026-10-20'`이 된다.
- AC-3 [W][P1]: Scenario: 잘못된 월급일
  - Given 설정 화면
  - When 월급일에 '32' 또는 '0'을 입력하고 저장을 탭
  - Then 월급일 TextField 아래에 "1~31 사이 날짜를 입력해주세요"를 표시하고 저장하지 않는다.
  - And localStorage 쓰기 호출은 0회다.
- AC-4 [W][P1]: Scenario: 월급 금액 범위 오류
  - Given 설정 화면
  - When 월급 실수령액이 '0'인 상태로 저장을 탭
  - Then 월급 실수령액 TextField 아래에 "0원보다 큰 금액을 입력해주세요"를 표시하고 저장하지 않는다.
  - And 빈 값('')은 저장 탭으로 검증하지 않는다. 빈 필드는 F2-AC-6·F2-AC-10의 `disabled`로만 막는다.
  - And '1,000,000,001'이면 "10억 원 이하로 입력해주세요"를 표시하고 저장하지 않는다.
  - And 두 경우 모두 localStorage 쓰기 호출은 0회다.
- AC-5 [W][P1]: Scenario: 저장 실패
  - Given saveSettings가 `{ ok: false, error: 'quota' }`를 돌려준다.
  - When 유효한 값으로 저장을 탭
  - Then Toast "저장하지 못했어요. 다시 시도해주세요"를 표시한다.
  - And 화면에 머물고 입력값 4개가 그대로 남는다.
- AC-6 [S][P1]: Scenario: 빈 초기 상태와 버튼 비활성
  - Given 저장된 설정이 없는 onboarding 상태
  - When 화면에 진입
  - Then 금액·날짜·잔고 TextField 3개가 빈 값이고, '주말이면' Chip은 '그대로'가 선택되어 있다.
  - And 세 TextField가 모두 채워질 때까지 SubmitFooter 버튼이 `disabled`다.
  - And 빈 필드는 `disabled`로만 막는다. 버튼이 `disabled`인 동안 잔고 필드에서 Enter를 눌러도 저장이 실행되지 않는다(localStorage 쓰기 0회).
  - And 필드를 빈 채로 두고 포커스를 벗어나면(blur) 그 필드 아래에 안내 문구를 표시한다.
    - 금액: "월급 실수령액을 입력해주세요"
    - 월급일: "월급일을 입력해주세요"
    - 잔고: "지금 잔고를 입력해주세요"
- AC-7 [S][P1]: Scenario: 모바일 키보드 동작
  - Given 금액 TextField에 포커스됨
  - While 가상 키보드가 열려 있는 동안
  - Then TextField는 `inputMode="numeric"`이고, 숫자가 아닌 문자는 입력되지 않는다.
  - And '2500000'을 타이핑하면 '2,500,000'으로 표시된다.
  - And 포커스된 필드는 `scrollIntoView({ block: 'center' })`로 키보드에 가려지지 않는다.
  - And 마지막 필드(잔고)에서 키보드 완료(Enter)를 누르면 저장이 실행된다. 단, SubmitFooter 버튼이 활성일 때만이다(F2-AC-6).
- AC-8 [E][P2]: Scenario: 잔고 필드 바로 포커스
  - Given `location.state = { mode: 'edit', focus: 'balance' }`
  - When 화면에 진입
  - Then 현재 잔고 TextField에 자동 포커스되고 '잔고 기준일: 10월 11일' 안내 텍스트가 보인다.
- AC-9 [W][P1]: Scenario: 잔고 범위 오류와 빈 값
  - Given 설정 화면
  - When 지금 통장 잔고에 '10,000,000,000'을 입력하고 저장을 탭
  - Then 잔고 TextField 아래에 "잔고는 9,999,999,999원 이하로 입력해주세요"를 표시하고 저장하지 않는다.
  - And localStorage 쓰기 호출은 0회다.
  - And 잔고가 '0'이면 오류 없이 `currentBalance: 0`으로 저장된다.
  - And edit 모드에서 잔고 TextField를 비우면 SubmitFooter 버튼이 `disabled`가 되고, 잔고 필드에서 Enter를 눌러도 저장이 실행되지 않는다(localStorage 쓰기 0회). blur 시 문구는 F2-AC-10을 따른다.
  - And 잔고 TextField에 'abc'를 입력하면 값이 바뀌지 않는다(F2-AC-7의 숫자 전용 입력).
- AC-10 [W][P1]: Scenario: edit 모드에서 필드를 비움
  - Given 저장값이 BASE.settings이고 `location.state = { mode: 'edit' }`
  - When 월급 실수령액 TextField를 지워 빈 값('')으로 만들고 포커스를 벗어남
  - Then 월급 실수령액 TextField 아래에 "월급 실수령액을 입력해주세요"가 보이고 SubmitFooter '저장' 버튼이 `disabled`다.
  - And 잔고 필드에서 Enter를 눌러도 저장되지 않는다(localStorage 쓰기 0회). `pcm.settings.v1`의 salaryAmount는 2500000으로 남는다.
  - And 월급일을 비우고 blur하면 "월급일을 입력해주세요", 잔고를 비우고 blur하면 "지금 잔고를 입력해주세요"가 보이고 버튼은 `disabled`다.
  - And 비운 필드에 다시 값을 넣으면 그 문구가 사라지고, 세 필드가 모두 채워지면 버튼이 활성이 된다.
- AC-11 [W][P1]: Scenario: 알 수 없는 저장 실패
  - Given saveSettings가 `{ ok: false, error: 'unknown' }`을 돌려준다.
  - When onboarding 또는 edit 모드에서 유효한 값으로 저장을 탭
  - Then Toast "저장하지 못했어요. 다시 시도해주세요"를 표시한다.
  - And 화면에 머물고(navigate 호출 0회) 입력값 4개가 그대로 남는다.
  - And `console.error` 호출은 0회다.
- AC-12 [W][P2]: Scenario: 저장 전 입력과 WebView 재로드·백그라운드 복귀
  - Given onboarding 상태에서 월급 실수령액 '2,500,000'과 월급일 '25'를 입력했고 아직 저장하지 않음
  - When 앱이 백그라운드로 갔다가 다시 보임(`visibilitychange` hidden→visible, 재로드 없음)
  - Then 두 필드 값이 '2,500,000'과 '25'로 유지된다.
  - And WebView가 재로드되면 `/setup`이 onboarding으로 다시 렌더되고 세 TextField는 빈 값이다. `pcm.settings.v1`은 없고 Toast는 표시하지 않는다.

### F3. 출금 항목 관리 (`/items` + 항목 BottomSheet)
- **Description**
  - 사용자가 월세·카드값·구독 등 출금 항목을 이름·금액·날짜·주말 처리로 자유롭게 추가·수정·삭제한다.
  - 이름 프리셋 ChipItem은 입력을 돕는 제안일 뿐이며, 항목은 `{ id, name }` 목록이다.
  - 같은 BottomSheet를 추가와 수정에 함께 쓴다.
  - 저장 순서 규칙: 추가는 `items` 끝에 붙이고, 수정은 같은 인덱스에서 교체하며, 삭제는 그 항목만 제거한다. 화면 정렬(F3-AC-7)은 표시용이며 저장 순서를 바꾸지 않는다.
- **Data**: OutflowStore/Outflow, PaySettings(합계 비율 표시용)
- **API**: 없음(localStorage)
- **Requirements**
- AC-1 [E][P0]: Scenario: 항목 추가
  - Given 출금 항목이 0개
  - When '출금 추가' Button을 탭한다.
  - And BottomSheet에서 `{ name: '월세', amount: '550,000', day: '24', 주말이면: '그대로' }`을 입력하고 '추가하기'를 탭한다.
  - Then `JSON.parse(localStorage['pcm.outflows.v1'])`가 `{ version: 1, items: [ { id, name: '월세', amount: 550000, day: 24, weekendRule: 'none' } ] }`이다. 시트가 닫힌다.
    - `id`는 길이 1~32의 비어 있지 않은 문자열이다.
    - 항목 키는 정확히 `id`, `name`, `amount`, `day`, `weekendRule` 5개이고 `dayChange` 키는 없다.
  - And 이름 '  월세  '로 입력해도 `name: '월세'`로 trim되어 저장된다.
  - And 항목이 있는 상태에서 추가하면 새 항목은 `items`의 마지막에 붙는다.
  - And Toast "추가했어요"를 표시한다.
  - And 목록에 ListRow "월세" / "매월 24일 · 주말이면 그대로" / "550,000원"이 보인다.
  - And `logClick('outflow_add_submit')`가 1회 호출된다.
- AC-2 [E][P0]: Scenario: 항목 수정
  - Given BASE 출금 4개가 저장되어 있고 today가 '2026-10-11'
  - When '월세' ListRow를 탭해 값이 미리 채워진 같은 BottomSheet를 연다.
  - And 이름을 '월세(관리비 포함)', 금액을 '600,000', 날짜를 '26'으로 바꾸고 '저장하기'를 탭한다.
  - Then `items[0]`(같은 인덱스)이 `{ id: 'o-rent', name: '월세(관리비 포함)', amount: 600000, day: 26, weekendRule: 'none' }`으로 저장된다.
    - 항목은 `applyDayChangeToItem`(F1-AC-13)으로 만든다.
    - 10-24와 10-26이 모두 오늘 이후라 `dayChange` 키는 없다.
  - And 나머지 3개 항목과 그 순서는 바뀌지 않는다.
  - And Toast "저장했어요"를 표시하고 목록 행이 즉시 바뀐다.
- AC-3 [E][P0]: Scenario: 항목 삭제
  - Given BASE 출금 4개가 저장되어 있음
  - When '넷플릭스' 수정 시트의 '삭제' Button을 탭하면 AlertDialog "'넷플릭스' 항목을 삭제할까요?"가 뜬다.
  - And '삭제'를 탭한다.
  - Then `pcm.outflows.v1`이 `{ version: 1, items: [월세, 카드값, 통신비] }`가 되고 Toast "삭제했어요"를 표시한다.
  - And AlertDialog에서 '취소'를 탭하면 항목이 유지된다.
- AC-4 [S][P1]: Scenario: 빈 목록과 이름 프리셋
  - Given 출금 항목이 0개
  - When 화면에 진입
  - Then Asset.ContentIcon과 "아직 등록한 출금이 없어요" 문구가 보인다.
  - And ChipItem 5개('월세', '카드값', '통신비', '보험료', '구독료')가 보인다.
  - And '카드값' ChipItem을 탭하면 이름이 '카드값'으로 채워지고 금액·날짜는 빈 BottomSheet가 열린다.
- AC-5 [W][P1]: Scenario: 입력 검증
  - Given 항목 BottomSheet
  - When 다음 값으로 제출
    - 이름 '   '
    - 금액 '0'
    - 금액 '100,000,001'
    - 날짜 '32'
    - 날짜 '0'
  - Then 해당 TextField 아래에 각각 다음 문구를 표시하고 저장하지 않는다.
    - "항목 이름을 입력해주세요"
    - "0원보다 큰 금액을 입력해주세요"
    - "1억 원 이하로 입력해주세요"
    - "1~31 사이 날짜를 입력해주세요"
    - "1~31 사이 날짜를 입력해주세요"
  - And 다섯 경우 모두 localStorage 쓰기 호출은 0회다.
  - And 이름 TextField는 `maxLength={20}`이다.
- AC-6 [W][P1]: Scenario: 30개 상한
  - Given 출금 항목이 30개
  - When '출금 추가' Button을 탭
  - Then 시트를 열지 않고 Toast "출금 항목은 30개까지 등록할 수 있어요"를 표시한다.
  - And 저장된 항목 수는 30개로 유지된다.
- AC-7 [U][P1]: Scenario: 정렬과 합계 요약
  - Given BASE 설정과 출금 4개
  - When 화면에 진입
  - Then 목록은 day 오름차순(카드값 14 → 넷플릭스 18 → 통신비 21 → 월세 24)으로 정렬된다. 같은 날이면 `items` 배열 순서(등록 순)다.
  - And 화면 정렬 후에도 저장된 `items` 순서는 [월세, 카드값, 통신비, 넷플릭스]로 바뀌지 않는다(localStorage 쓰기 0회).
  - And 상단에 data-testid="outflow-total" 텍스트 "매월 출금 합계 1,052,000원 · 월급의 42%"와 MiniBar(42%)가 보인다.
  - And 목록은 최대 30행이라 가상 스크롤 없이 페이지 스크롤만 쓴다.
- AC-8 [W][P1]: Scenario: 저장 실패
  - Given saveOutflows가 `{ ok: false, error: 'quota' }`를 돌려준다.
  - When 항목 추가·수정·삭제 중 하나를 실행
  - Then Toast "저장하지 못했어요. 다시 시도해주세요"를 표시한다.
  - And 목록은 실행 전 상태로 유지되고, 추가·수정 시트는 열린 채 입력값을 유지한다.
- AC-9 [W][P1]: Scenario: 시트의 빈 필드
  - Given 추가 모드 BottomSheet가 열려 있고 이름은 '월세'
  - When 금액 또는 매월 출금일 TextField를 빈 값('')으로 둠
  - Then '추가하기' Button이 `disabled`이고, 탭해도 저장되지 않는다(localStorage 쓰기 0회).
  - And 빈 필드에서 포커스를 벗어나면 그 필드 아래에 문구를 표시한다.
    - 금액: "금액을 입력해주세요"
    - 날짜: "출금일을 입력해주세요"
    - 이름이 빈 값('')이면: "항목 이름을 입력해주세요"
  - And 공백만 있는 이름('   ')은 빈 값이 아니므로 버튼은 활성이다. 제출하면 F3-AC-5에 따라 막힌다.
  - And 수정 모드에서 '월세' 항목의 금액을 지우면 '저장하기'가 `disabled`이고 `pcm.outflows.v1`의 월세 금액은 550000으로 남는다.
  - And 세 필드가 모두 채워지면 버튼이 활성이 된다.
- AC-10 [W][P1]: Scenario: 알 수 없는 저장 실패
  - Given saveOutflows가 `{ ok: false, error: 'unknown' }`을 돌려준다.
  - When 항목 추가·수정·삭제 중 하나를 실행
  - Then Toast "저장하지 못했어요. 다시 시도해주세요"를 표시한다.
  - And 목록은 실행 전 상태로 유지되고, 추가·수정 시트는 열린 채 입력값을 유지한다.
  - And 삭제였다면 AlertDialog가 닫히고 수정 시트는 열린 채 남으며, 항목은 목록에 그대로 있다.
  - And `logClick('outflow_add_submit')`은 검증을 통과했으므로 1회 호출된다. 성공 Toast("추가했어요"·"저장했어요"·"삭제했어요")는 0회다.
- AC-11 [W][P2]: Scenario: 시트 미저장 입력과 WebView 재로드·백그라운드 복귀
  - Given `location.state = { openAdd: true }`로 진입해 추가 시트가 열렸고, 이름 '월세'와 금액 '550,000'을 입력했으며 아직 저장하지 않음
  - When 앱이 백그라운드로 갔다가 다시 보임(`visibilitychange` hidden→visible, 재로드 없음)
  - Then 시트가 열린 채 '월세'와 '550,000'이 유지된다.
  - And WebView가 재로드되면 `/items`가 시트가 닫힌 상태로 렌더된다. 입력값은 사라지고 `pcm.outflows.v1`은 바뀌지 않으며 Toast는 없다.
  - And 재로드 후 시트가 다시 열리지 않도록, `openAdd`를 처리한 직후 `navigate('.', { replace: true, state: { ...state, openAdd: false } })`로 state를 비운다.
- AC-12 [W][P1]: Scenario: 대기 중인 날짜 변경이 있는 항목의 수정
  - Given today '2026-10-11'이고 카드값이 `{ id: 'o-card', name: '카드값', amount: 420000, day: 26, weekendRule: 'none', dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`로 저장되어 있음
  - When 수정 시트를 연다(날짜 필드에는 `day` 값 26이 미리 채워진다).
  - And 금액만 '450,000'으로 바꿔 '저장하기'를 탭한다.
  - Then 카드값은 `{ id: 'o-card', name: '카드값', amount: 450000, day: 26, weekendRule: 'none', dayChange: { fromDay: 10, effectiveMonth: '2026-11' } }`로 저장된다. dayChange가 유지된다.
  - And 같은 시트에서 날짜를 '10'으로 바꿔 저장하면 `{ id: 'o-card', name: '카드값', amount: 450000, day: 10, weekendRule: 'none' }`로 저장된다. 저장 문자열에 `"dayChange"`가 없다(F1-AC-13).

### F4. 잔고 달력 화면 — 무료 층 (`/`)
- **Description**
  - 이번 달 달력 칸마다 그날의 출금 항목 이름과 하루 마감 예상 잔고를 표시한다.
  - 달력 아래에 이번 달 출금 일정을 항목 이름별로 한 줄씩 나열한다.
  - 날짜를 탭하면 그날의 상세를 BottomSheet로 본다. Tab으로 다음 달 달력을 본다.
  - 저장소 사용 불가(F4-AC-11)와 정의되지 않은 경로(F4-AC-12)의 앱 공통 처리를 함께 둔다.
- **Data**: PaySettings, Outflow, DayBalance(파생)
- **API**: 없음(localStorage)
- **Requirements**
- AC-1 [E][P0]: Given 픽스처 BASE가 저장되어 있고 today가 '2026-10-11'일 때 When 사용자가 홈('/')에 진입하면 Then data-testid="day-cell-2026-10-24" 칸에 '월세'와 '-25.2만'(색 var(--adaptiveRed500))이 표시되고, data-testid="lowest-day-card"에 "10월 24일 (토)"와 "-252,000원"이 표시된다
- AC-2 [U][P0]: Scenario: 달력 그리드 레이아웃
  - Given 픽스처 BASE, today '2026-10-11'
  - When 홈 진입
  - Then data-testid="calendar-grid"가 Card 안에 있고, 머리줄 '일 월 화 수 목 금 토' 7열 CSS grid다.
  - And 2026-10-01(목)이 5번째 열에서 시작하고 날짜 칸 31개가 있다.
  - And 10-01~10-10 칸은 var(--adaptiveGrey400) 글자색이고 잔고를 표시하지 않는다. 이 칸들에도 `buildMonthEvents` 기준으로 등록 항목 이름은 표시한다(F4-AC-10).
  - And 10-11부터 칸마다 formatCompactWon(endBalance)를 표시한다(10-14 '38만', 10-25 '224.8만').
  - And 한 칸에 항목 이름은 최대 1개만 말줄임으로 보이고, 나머지는 '+N'으로 표시된다.
- AC-3 [U][P0]: Scenario: 등록한 항목이 자기 이름으로 한 줄씩
  - Given 픽스처 BASE
  - When 홈 진입
  - Then data-testid="schedule-list"에 ListRow 5개가 actualDate 순으로 보인다.
    - "10월 14일 (수) 카드값" / "-420,000원 · 잔고 380,000원"
    - "10월 18일 (일) 넷플릭스" / "-17,000원 · 잔고 363,000원"
    - "10월 21일 (수) 통신비" / "-65,000원 · 잔고 298,000원"
    - "10월 24일 (토) 월세" / "-550,000원 · 잔고 -252,000원"
    - "10월 25일 (일) 월급" / "+2,500,000원 · 잔고 2,248,000원"
  - And 행 목록은 `buildMonthEvents(이번 달)`로 만든다. balanceAsOf 이전·당일 항목도 행에서 빠지지 않는다.
  - And actualDate ≤ balanceAsOf인 항목은 입력한 잔고에 이미 반영된 출금이다. 이 행의 보조 텍스트는 "-{금액}원 · 지남"이고 잔고 금액은 없다.
  - And balanceAsOf < actualDate < today인 항목은 "-{금액}원 · 잔고 {endBalance}원 · 지남"으로 표시한다.
  - And 보정된 항목은 보조 텍스트 "주말이라 10월 26일(월)로"를 표시한다.
- AC-4 [E][P1]: Scenario: 날짜 상세 BottomSheet
  - Given 픽스처 BASE
  - When 10-24 칸(최소 높이 48px)을 탭
  - Then BottomSheet 제목 "10월 24일 (토)", ListRow "월세 -550,000원", "하루 마감 잔고 -252,000원"이 보인다.
  - And 10-12 칸을 탭하면 "이날은 출금·입금이 없어요"와 "하루 마감 잔고 800,000원"이 보인다.
  - And 하루 중 최저(lowBalance)가 마감 잔고와 다르면 "출금 후 최저 {lowBalance}원" 줄을 추가로 표시한다.
- AC-5 [S][P1]: Scenario: 출금 항목 0개 빈 상태
  - Given 설정은 있고 출금 항목이 0개
  - When 홈 진입
  - Then data-testid="free-tier" 상단에 Asset.ContentIcon과 "출금 항목을 등록하면 잔고가 얇아지는 날을 찍어드려요"가 보인다.
  - And display="block" Button '출금 항목 추가'를 탭하면 `navigate('/items', { state: { openAdd: true } })`로 이동한다.
  - And 달력에는 월급(10-25)만 표시된다.
- AC-6 [W][P1]: Scenario: 설정 없음·손상 시 온보딩으로
  - Given `loadSettings()`가 다음 중 하나를 돌려줌
    - `{ settings: null, recovered: false }`(키 없음)
    - `{ settings: null, recovered: true }`(손상·버전 불일치로 삭제, F1-AC-11)
  - When 홈 진입
  - Then `navigate('/setup', { replace: true, state: { mode: 'onboarding' } })`로 이동한다.
  - And `recovered: true`일 때만 Toast "저장된 정보를 불러오지 못해 다시 입력이 필요해요"를 1회 표시한다.
  - And `recovered: false`(키 없음)이면 Toast를 표시하지 않는다.
- AC-7 [S][P1]: Scenario: 다음 달 탭
  - Given 픽스처 BASE
  - When TDS Tab '다음 달 (11월)'을 탭
  - Then calendar-grid가 2026-11로 바뀌고 11-01(일)이 1번째 열에서 시작하며 칸이 30개다.
  - And 11-24 칸에 '월세'와 '119.6만'이 보인다.
  - And schedule-list는 11월 항목 5행으로 바뀐다.
  - And 투영은 balanceAsOf부터 2026-11-30까지 계산하고, 잔고 표시는 today 이후 칸만 한다.
- AC-8 [U][P1]: Scenario: 검수 — 색상·외부 이동·설치 유도 금지
  - Given 프로덕션 빌드 소스 `src/`
  - When 정적 검사를 실행
  - Then `#[0-9a-fA-F]{3,8}\b` 색상 리터럴은 0건이다. 마이너스 잔고는 var(--adaptiveRed500), 크런치 칸 배경은 var(--adaptiveRed50), 지난 날은 var(--adaptiveGrey400)를 쓴다.
  - And `window.open(` 호출과 `location.href = 'http` 대입은 0건이다.
  - And '설치', '다운로드' 문자열은 0건이다.
- AC-9 [W][P1]: Scenario: 출금 항목 데이터 손상
  - Given BASE.settings가 정상 저장되어 있고, `pcm.outflows.v1`이 다음 중 하나다.
    - `'{bad'`
    - `'{"a":1}'`
    - `{ version: 1, items: BASE.outflows }`에서 '넷플릭스'만 `amount: -5`
  - When 홈 진입
  - Then Toast "일부 출금 항목을 불러오지 못했어요"를 1회 표시한다.
  - And 앞의 두 경우는 키가 삭제되고 F4-AC-5의 빈 상태가 보인다.
  - And 셋째 경우는 schedule-list에 카드값·통신비·월세·월급 4행이 보이고 '넷플릭스' 행은 없다.
  - And 같은 상태에서 홈에 다시 진입하면 Toast를 표시하지 않는다.
  - And `console.error` 호출은 0회다.
- AC-10 [U][P0]: Scenario: 잔고 기준일 이전 날짜의 항목도 자기 이름으로 보인다
  - Given BASE.outflows 끝에 `{ id: 'o-mgmt', name: '관리비', amount: 100000, day: 5, weekendRule: 'none' }`을 더해 `{ version: 1, items: [...BASE.outflows, 관리비] }`로 저장했고, today가 '2026-10-11'이다. 10-05(월)는 balanceAsOf '2026-10-11' 이전이다.
  - When 홈 진입
  - Then schedule-list는 6행이다. 첫 행은 "10월 5일 (월) 관리비" / "-100,000원 · 지남"이고 잔고 금액은 없다.
  - And day-cell-2026-10-05에 '관리비'가 var(--adaptiveGrey400)로 표시되고 잔고 숫자는 없다.
  - And 10-05 출금은 잔고에서 다시 빼지 않는다. 그래서 day-cell-2026-10-14는 '38만'이고, lowest-day-card는 "10월 24일 (토)"와 "-252,000원"으로 BASE와 같다.
  - And Tab '다음 달 (11월)'을 탭하면 schedule-list에 "11월 5일 (목) 관리비" / "-100,000원 · 잔고 2,148,000원" 행이 보인다.
- AC-11 [W][P1]: Scenario: localStorage에 접근할 수 없음(모든 라우트)
  - Given `probeStorage()`가 false다(`window.localStorage` getter 또는 `getItem`이 예외를 던지도록 mock).
  - When `/`, `/setup`, `/items` 중 어느 경로로 진입
  - Then 라우트 내용 대신 data-testid="storage-unavailable" 상태가 렌더된다. 구성은 다음과 같다.
    - Top 제목 "텅장달력"
    - Asset.ContentIcon
    - Paragraph.Text "저장 공간을 쓸 수 없어 달력을 만들 수 없어요"
    - Paragraph.Text "토스 앱을 완전히 닫았다가 다시 열어주세요"
    - display="block" Button '다시 시도'
  - And `/setup`으로의 navigate 호출, 다른 Toast, FloatingTabBar, AdSlot, TossRewardAd는 모두 0개다.
  - And '다시 시도'를 탭했을 때 `probeStorage()`가 여전히 false면 Toast "아직 저장 공간을 쓸 수 없어요"를 표시하고 같은 상태에 머문다.
  - And mock을 해제한 뒤(BASE 저장됨) '다시 시도'를 탭하면 원래 경로의 화면이 렌더된다. 홈이면 lowest-day-card "10월 24일 (토)"가 보인다.
  - And `console.error` 호출은 0회다.
- AC-12 [W][P2]: Scenario: 정의되지 않은 경로 직접 진입
  - Given 픽스처 BASE가 저장되어 있음
  - When `/result` 또는 `/foo/bar`로 직접 진입(`location.state = null`)
  - Then `location.pathname`이 `'/'`가 되고 홈이 렌더된다(lowest-day-card "10월 24일 (토)" 표시).
  - And 이동은 replace라, 뒤로 가기를 눌러도 `/result`로 돌아가지 않는다.
  - And 안내 Toast는 표시하지 않는다.
  - And 설정이 없으면 이어서 F4-AC-6에 따라 `/setup` onboarding으로 이동한다.

### F5. 최저 잔고일 카드 & 월급 전 최저 구간 강조
- **Description**
  - 무료 층 맨 위에 '이번 달 최저 잔고일' 카드를 둔다. 날짜·금액·부족액을 CountUp 히어로로 보여 준다.
  - 달력에서 최저 잔고일과 월급 전 최저 구간(크런치)을 강조한다.
  - 같은 블록에 잔고 추이 Sparkline, 배너 광고, 공유 버튼을 둔다.
- **Data**: MonthSummary, DayBalance(파생)
- **API**: 없음(localStorage)
- **Requirements**
- AC-1 [E][P0]: Scenario: 최저 잔고일 카드
  - Given 픽스처 BASE, today '2026-10-11'
  - When 홈 진입
  - Then data-testid="lowest-day-card" Card에 다음이 보인다.
    - "이번 달 최저 잔고일 · 10월 24일 (토)"
    - SummaryHero value CountUp 최종값 "-252,000원"(t2 타이포)
    - Badge "잔고 부족"
    - "10월 24일부터 마이너스예요 · 252,000원 부족"
  - And `logImpression('lowest_day_card')`가 1회 호출된다.
- AC-2 [E][P0]: Scenario: 크런치 구간 강조
  - Given BASE에서 salaryWeekendRule을 'prevBusinessDay'로, 월세(`o-rent`) weekendRule을 'nextBusinessDay'로 바꾼 설정
  - When 홈 진입
  - Then day-cell-2026-10-21과 day-cell-2026-10-22에 `data-crunch="true"`가 붙는다.
  - And day-cell-2026-10-21에 `data-lowest="true"`가 붙는다.
  - And 카드에 "월급 전 최저 구간 10월 21일 ~ 10월 22일 (2일)"과 "298,000원"이 보이고 Badge "잔고 부족"은 없다.
- AC-3 [U][P1]: Scenario: 다음 달 탭의 카드
  - Given 픽스처 BASE
  - When Tab '다음 달 (11월)'을 탭
  - Then 카드 제목이 "11월 최저 잔고일 · 11월 24일 (화)", 값이 "1,196,000원"이 된다.
  - And "월급 전 최저 구간 11월 24일 하루"가 보인다.
- AC-4 [U][P2]: Scenario: 잔고 추이 Sparkline
  - Given 픽스처 BASE
  - When 홈 진입
  - Then 카드 안 data-testid="balance-sparkline"이 10-11부터 10-31까지 endBalance 21개 점으로 그려진다.
  - And 최저점(10-24)에 점 표시가 있다.
- AC-5 [U][P1]: Scenario: 배너 위치와 실패 내성
  - Given 홈 화면
  - When 렌더
  - Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 data-testid="schedule-list" 아래, data-testid="sim-section" 위에 있고 free-tier 바깥이다. 콘텐츠와 겹치지 않는다.
  - And 노출 시 `logImpression('banner_calendar')`가 호출된다.
  - And 광고 로드에 실패해도 lowest-day-card·calendar-grid·schedule-list가 모두 렌더된다. 배너 자리는 비어 있고 오류 문구는 없다.
- AC-6 [E][P1]: Scenario: 공유
  - Given 결과(lowest-day-card)가 표시된 상태
  - When display="block" Button '내 잔고 달력 공유하기'를 탭
  - Then `logClick('share_calendar')`와 `shareApp()`이 각각 1회 호출된다.
  - And shareApp이 reject하면 Toast "공유하지 못했어요"를 표시한다.
- AC-7 [S][P1]: Scenario: 카드 숨김 조건(빈 상태)
  - Given 출금 항목이 0개
  - When 홈 진입
  - Then data-testid="lowest-day-card"와 공유 Button은 렌더되지 않고 F4-AC-5의 빈 상태가 보인다.
  - And `logImpression('lowest_day_card')` 호출은 0회다.

### F6. 출금일 이동 시뮬레이션 — 잠금 층 (리워드 게이트)
- **Description**
  - 등록한 출금 항목마다 1~28일을 모두 대입해, 오늘부터 다음 달 말일까지의 최저 잔고를 가장 많이 올리는 날짜와 증가액을 항목 이름별로 보여 준다.
  - 항목을 탭하면 직접 날짜(1~31)를 넣어 비교하고 그 날짜로 저장할 수 있다.
  - 이 블록만 `TossRewardAd`의 자식이다.
  - 게이트 바깥에 안내 문구(locked-teaser)를 두어, 광고 로딩 중이나 취소 후에도 이 영역이 무엇인지 보이게 한다.
- **Data**: PaySettings, Outflow, SimResult(파생)
- **API**: 없음(localStorage)
- **구조**
  - `data-testid="sim-section"`은 아래 두 요소를 담는다.
    - `data-testid="locked-teaser"`: 게이트 바깥이다.
    - `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`와 그 자식 `data-testid="locked-tier"`
  - locked-teaser 내용은 다음과 같다.
    - Paragraph.Text "항목별로 가장 유리한 출금일을 찾아드려요"
    - Paragraph.Text "광고를 끝까지 보면 열려요"
  - locked-tier가 마운트되면 effect에서 부모의 `onUnlocked()`를 호출한다. 이후 locked-teaser는 렌더하지 않는다.
  - 이 해제 상태는 컴포넌트 세션 상태다. 저장하지 않는다.
  - 게이트 버튼, 광고 로딩 표시, 타임아웃 값은 템플릿 TossRewardAd의 동작을 그대로 쓴다. 이 SPEC에서 재정의하지 않는다.
- **엔진** (`src/lib/balance/simulate.ts`)
  - `simulateShift(settings, outflows, itemId, toDay, today): SimResult`
    - toDay는 1~31이다. 29~31은 짧은 달에 말일로 보정하고, 항목의 weekendRule을 그대로 적용한다.
    - 시뮬레이션 구간: today부터 today가 속한 달의 다음 달 말일까지, lowBalance 최솟값.
    - 이번 달 적용 규칙: 이번 달의 원래 actualDate와 새 actualDate가 모두 today 이후일 때만 이번 달부터 새 날짜를 적용한다. 그렇지 않으면 이번 달은 원래 날짜를 유지하고 다음 달부터 적용한다.
  - `bestShifts(settings, outflows, today): SimResult[]`
    - 항목마다 후보 1~28일(원래 날짜 제외) 중 newMin이 최대인 날을 고른다. 29~31일은 달마다 처리 날짜가 달라 추천 후보에서 뺀다. 직접 입력으로는 비교할 수 있다(F6-AC-10).
    - 동률이면 원래 날짜와의 차가 작은 날, 그다음 이른 날을 고른다.
    - delta ≤ 0이면 `toDay = fromDay, delta = 0, improved = false`다.
    - 정렬은 delta 내림차순, 같으면 이름 순이다.
  - 저장: '이 날짜로 저장'은 `applyDayChangeToItem(item, toDay, today)`(F1)로 만든 항목을 같은 인덱스에 교체한 뒤 `saveOutflows`를 호출한다.
- **Requirements**
- AC-1 [U][P0]: Scenario: 무료 층은 광고와 무관하게 보인다
  - Given 광고가 한 번도 뜨지 않는 환경(`VITE_TOSS_AD_SLOT_ID` 미설정·광고 로드 실패·타임아웃 — 템플릿 TossRewardAd는 이때 게이트를 자동으로 연다)과 픽스처 BASE
  - When 사용자가 홈('/')에 진입
  - Then data-testid="free-tier" 영역에 다음이 표시되어, 어느 날 잔고가 바닥나는지 알게 되는 PRD 목표가 달성된다.
    - lowest-day-card "10월 24일 (토) · -252,000원"
    - calendar-grid
    - schedule-list 5행
  - And free-tier는 `<TossRewardAd>`의 바깥이다. 코드 구조 규칙이므로 리뷰로 확인한다.
- AC-2 [E][P1]: Scenario: 더 깊은 층은 게이트 뒤에 있다
  - Given 홈의 data-testid="locked-tier" 영역이 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`의 자식으로 렌더될 때
  - When 광고 시청이 완료되거나, 광고를 띄울 수 없어 게이트가 자동으로 열림
  - Then data-testid="locked-tier"에 제목 "출금일을 옮기면"과 ListRow 4개가 순서대로 표시된다.
    - data-testid="sim-row-o-rent" "월세 24일 → 26일" / "최저 잔고 +550,000원"
    - data-testid="sim-row-o-card" "카드값 14일 → 26일" / "+420,000원"
    - data-testid="sim-row-o-phone" "통신비 21일 → 26일" / "+65,000원"
    - data-testid="sim-row-o-netflix" "넷플릭스 18일 → 26일" / "+17,000원"
  - And 하단 Paragraph.Text가 "오늘부터 다음 달 말일까지의 예상 잔고 기준이에요. 실제로 바꿀 수 있는 날짜는 카드사·은행에 확인하세요"이고 링크는 없다.
  - And `logImpression('sim_locked_tier')`가 1회 호출된다.
  - And data-testid="locked-teaser"는 렌더되지 않는다.
- AC-3 [U][P0]: Scenario: 최적 이동일 계산
  - Given 픽스처 BASE, today '2026-10-11'
  - When `bestShifts(...)`를 호출
  - Then 월세 결과는 `{ itemId: 'o-rent', fromDay: 24, toDay: 26, baseMin: -252000, newMin: 298000, delta: 550000, improved: true }`다. 26~28일이 동률이고 차가 가장 작은 26일이 선택된다.
  - And 25일 후보는 같은 날 출금이 먼저 나가므로 newMin이 -252,000이 되어 선택되지 않는다.
  - And 카드값 결과는 `{ itemId: 'o-card', toDay: 26, newMin: 168000, delta: 420000 }`다.
- AC-4 [U][P0]: Scenario: 이미 지난 날짜로 옮기면 이번 달은 원래 날짜 유지
  - Given 픽스처 BASE, today '2026-10-11'
  - When `simulateShift(..., 'o-rent', 5, '2026-10-11')`
  - Then 10월 월세는 10-24에 유지되고 11월 월세는 11-05로 반영된다.
  - And 결과는 `{ baseMin: -252000, newMin: -252000, delta: 0, improved: false }`다.
- AC-5 [E][P0]: Scenario: 직접 날짜 넣어 보고 저장
  - Given locked-tier가 열린 상태(픽스처 BASE, today '2026-10-11')
  - When sim-row '월세'를 탭하면 BottomSheet "출금일 바꿔보기"가 열리고 날짜 TextField 기본값은 26이다. 여기서 '28'을 입력한다.
  - Then 시트에 "지금 최저 -252,000원 → 바꾸면 298,000원 (+550,000원)"이 보인다.
  - And '이 날짜로 저장'을 탭하면 다음이 일어난다.
    - `items[0]`이 `{ id: 'o-rent', name: '월세', amount: 550000, day: 28, weekendRule: 'none' }`으로 저장된다. 10-24·10-28이 모두 오늘 이후라 `dayChange` 키는 없다.
    - Toast "월세 출금일을 28일로 바꿨어요"를 표시한다.
    - lowest-day-card가 "298,000원"으로 다시 계산된다.
    - `logClick('sim_save_day')`와 `requestReviewOnce()`가 각각 1회 호출된다.
- AC-6 [S][P1]: Scenario: 옮겨도 나아지지 않을 때
  - Given settings는 BASE.settings, outflows는 `[{ id: 'o-rent', name: '월세', amount: 550000, day: 26, weekendRule: 'none' }]`, today는 '2026-10-11'
  - When locked-tier가 열림
  - Then sim-row-o-rent가 "월세 26일 · 지금 날짜가 가장 유리해요" / "변화 없음 (0원)"으로 표시된다.
  - And 이 행에는 화살표 날짜가 없다.
- AC-7 [W][P1]: Scenario: 시뮬레이션 날짜 입력 오류와 저장 실패
  - Given "출금일 바꿔보기" 시트
  - When 날짜에 '0' 또는 '32'를 입력
  - Then "1~31 사이 날짜를 입력해주세요"를 표시하고, 비교 문구를 숨기며, '이 날짜로 저장' 버튼이 disabled가 된다.
  - And 유효한 날짜에서 saveOutflows가 `{ ok: false, error: 'quota' }`를 돌려주면 Toast "저장하지 못했어요. 다시 시도해주세요"를 표시하고 항목 날짜를 바꾸지 않는다.
- AC-8 [S][P1]: Scenario: 출금 0개면 잠금 층 없음
  - Given 출금 항목이 0개
  - When 홈 진입
  - Then data-testid="sim-section", "locked-teaser", "locked-tier"와 `TossRewardAd`가 마운트되지 않는다.
  - And 광고 로드 호출은 0회다.
- AC-9 [W][P1]: Scenario: 시뮬레이션 날짜를 비움
  - Given locked-tier가 열려 있고 '월세'의 "출금일 바꿔보기" 시트가 기본값 26으로 열려 있음
  - When 날짜 TextField를 지워 빈 값('')으로 만듦
  - Then 날짜 TextField 아래에 "바꿀 날짜를 입력해주세요"가 보이고, 비교 문구("지금 최저 … → 바꾸면 …")가 숨겨지며, '이 날짜로 저장' 버튼이 `disabled`다.
  - And 버튼이나 키보드 Enter를 눌러도 saveOutflows 호출은 0회이고, `logClick('sim_save_day')`도 0회다.
  - And '26'을 다시 입력하면 문구가 사라지고 비교 문구와 버튼이 돌아온다.
- AC-10 [U][P1]: Scenario: 시뮬레이션 날짜 29~31 입력
  - Given 픽스처 BASE, today '2026-10-11', '월세' "출금일 바꿔보기" 시트
  - When 날짜에 '31'을 입력
  - Then `simulateShift(..., 'o-rent', 31, '2026-10-11')`로 계산한다. 10월 월세는 10-31(토, weekendRule 'none')에, 11월 월세는 말일 보정된 11-30에 반영된다.
  - And 결과는 `{ baseMin: -252000, newMin: 298000, delta: 550000, improved: true }`다.
  - And 시트에 "지금 최저 -252,000원 → 바꾸면 298,000원 (+550,000원)"과 Paragraph.Text "29~31일은 그 날짜가 없는 달에 말일로 계산해요"가 보인다.
  - And 날짜가 1~28이면 이 안내 문구는 표시하지 않는다.
  - And '이 날짜로 저장'을 탭하면 다음이 일어난다.
    - `items[0]`이 `{ id: 'o-rent', name: '월세', amount: 550000, day: 31, weekendRule: 'none' }`으로 저장된다. `dayChange` 키는 없다.
    - Toast "월세 출금일을 31일로 바꿨어요"가 표시된다.
    - lowest-day-card는 "10월 21일 (수)"와 "298,000원"으로 다시 계산된다.
- AC-11 [S][P1]: Scenario: 리워드 광고 로딩 중
  - Given 픽스처 BASE, `VITE_TOSS_AD_SLOT_ID`가 설정되어 있고, 광고 로드가 끝나지 않은 상태(pending)로 mock됨
  - When 홈 진입
  - Then 첫 렌더에서 free-tier(lowest-day-card, calendar-grid, schedule-list)가 모두 보인다. 광고 로드를 기다리지 않는다.
  - And data-testid="sim-section" 안에 locked-teaser "항목별로 가장 유리한 출금일을 찾아드려요" / "광고를 끝까지 보면 열려요"가 보인다.
  - And data-testid="locked-tier"는 DOM에 없고, `logImpression('sim_locked_tier')` 호출은 0회다.
  - And 앱은 free-tier를 가리는 별도 스피너·오버레이를 띄우지 않는다.
  - And 이후 광고 로드가 실패하거나 템플릿 타임아웃이 지나 게이트가 자동으로 열리면, F6-AC-2의 locked-tier가 보이고 locked-teaser는 사라진다.
- AC-12 [W][P1]: Scenario: 광고를 끝까지 보지 않고 닫음
  - Given 리워드 광고가 화면에 표시되어 있음
  - When 사용자가 보상 지급 전에 광고를 닫음
  - Then data-testid="locked-tier"는 마운트되지 않고, locked-teaser "광고를 끝까지 보면 열려요"가 계속 보인다.
  - And 오류 Toast는 표시하지 않는다. `logImpression('sim_locked_tier')`와 localStorage 쓰기는 모두 0회다.
  - And free-tier 내용(lowest-day-card "10월 24일 (토) · -252,000원")은 바뀌지 않는다.
- AC-13 [W][P1]: Scenario: 광고를 띄울 수 없으면 잠금 층이 열린다(확정 정책)
  - Given 픽스처 BASE이고 다음 중 하나다.
    - 기기가 오프라인이라 광고 로드가 실패함
    - `VITE_TOSS_AD_SLOT_ID`가 비어 있음
  - When 홈 진입
  - Then 템플릿 TossRewardAd가 게이트를 자동으로 열고, data-testid="locked-tier"에 F6-AC-2의 sim-row 4개가 보인다.
  - And 광고 실패를 알리는 문구나 Toast는 0개다.
  - And `logImpression('sim_locked_tier')`가 1회 호출된다.
  - And 이 동작은 Assumptions의 '광고 실패 시 잠금 층 열림' 정책으로 승인된 것이다.
- AC-14 [W][P2]: Scenario: 리뷰 요청 실패는 무음 처리
  - Given locked-tier가 열려 있고, `requestReviewOnce()`가 reject하거나 예외를 던지거나 사용자가 리뷰 창을 닫음
  - When '월세' 시트에서 '28'로 '이 날짜로 저장'을 탭하고 저장이 성공
  - Then Toast는 "월세 출금일을 28일로 바꿨어요" 1개만 표시된다.
  - And 시트가 닫히고 월세는 `day: 28`로 저장된다.
  - And `console.error` 호출과 처리되지 않은 Promise rejection은 모두 0회다.
- AC-15 [W][P1]: Scenario: 시뮬레이션 저장의 알 수 없는 실패
  - Given locked-tier가 열려 있고 saveOutflows가 `{ ok: false, error: 'unknown' }`을 돌려줌
  - When '월세' 시트에서 '28'을 입력하고 '이 날짜로 저장'을 탭
  - Then Toast "저장하지 못했어요. 다시 시도해주세요"를 표시한다.
  - And 시트는 열린 채 '28'이 남고, 월세 day는 24로 유지된다. lowest-day-card는 "-252,000원"이다.
  - And `logClick('sim_save_day')`는 1회, `requestReviewOnce()`는 0회 호출된다.

### F7. 다음 달 자동 이월 & 잔고 기준일 관리
- **Description**
  - 달이 바뀌면 홈이 자동으로 새 달 달력을 보여 준다. 잔고 기준일부터 투영을 이어 가므로 등록한 항목이 매달 그대로 이월된다.
  - 기준일이 지난달이면 지금 잔고를 다시 넣으라는 행을 띄운다.
  - 기준일이 너무 오래되면 잔고 표시를 멈춘다.
  - 기존 `/setup` 화면을 재사용하므로 새 화면은 없다.
- **Data**: AppMeta, PaySettings, Outflow
- **API**: 없음(localStorage)
- **Requirements**
- AC-1 [E][P0]: Scenario: 새 달 진입 자동 이월
  - Given 픽스처 BASE, `pcm.meta.v1 = { version: 1, lastSeenMonth: '2026-10' }`, today '2026-11-02'
  - When 홈 진입
  - Then Tab 라벨이 '이번 달 (11월)' / '다음 달 (12월)'이고, 기본 선택은 이번 달이며, calendar-grid는 2026-11이다.
  - And Toast "11월 달력으로 넘어왔어요"를 1회 표시하고 `pcm.meta.v1`을 `{ version: 1, lastSeenMonth: '2026-11' }`로 저장한다.
  - And 같은 달에 다시 진입하면 Toast를 표시하지 않는다.
- AC-2 [U][P0]: Scenario: 기준일부터 이어지는 투영
  - Given 픽스처 BASE(balanceAsOf '2026-10-11'), today '2026-11-02'
  - When 홈 진입
  - Then day-cell-2026-11-02의 잔고가 '224.8만'(2,248,000)이다.
  - And 11-01 칸은 지난 날로 잔고를 표시하지 않는다.
  - And lowest-day-card는 "11월 24일 (화) · 1,196,000원"이다.
  - And 4개 항목이 11월 schedule-list에 모두 이름으로 표시된다.
- AC-3 [S][P1]: Scenario: 잔고 기준일 갱신 안내
  - While balanceAsOf의 달('2026-10')이 today의 달('2026-11')과 다른 동안
  - Then free-tier 맨 위에 data-testid="stale-balance-row" ListRow "잔고 기준일이 10월 11일이에요" / "지금 잔고로 바꾸기"가 보인다.
  - And 탭하면 `navigate('/setup', { state: { mode: 'edit', focus: 'balance' } })`로 이동한다.
- AC-4 [E][P1]: Scenario: 잔고 갱신 후 재계산
  - Given today '2026-11-02'
  - When 설정 화면에서 잔고를 '1,500,000'으로 바꿔 저장하고 홈으로 돌아옴
  - Then `balanceAsOf = '2026-11-02'`이고 stale-balance-row가 사라진다.
  - And lowest-day-card는 "11월 24일 (화) · 448,000원"이다.
- AC-5 [W][P1]: Scenario: 기준일이 62일을 넘으면 잔고 숨김
  - Given balanceAsOf '2026-10-11', today '2026-12-13'(63일 경과)
  - When 홈 진입
  - Then calendar-grid 칸에 잔고 숫자가 0개 표시되고, lowest-day-card와 sim-section(locked-teaser·locked-tier)이 렌더되지 않는다.
  - And Asset.ContentIcon, "잔고 기준일이 너무 오래됐어요 (10월 11일)", display="block" Button '지금 잔고 입력'이 보인다.
  - And today가 '2026-12-12'(62일)이면 잔고가 표시된다.
- AC-6 [W][P1]: Scenario: 메타 데이터 없음·손상·버전 불일치
  - Given `pcm.meta.v1`이 다음 중 하나
    - 키 없음
    - `'{bad'`
    - `'{"version":2,"lastSeenMonth":"2026-10"}'`
    - `'{"lastSeenMonth":"2026-10"}'`(version 없음)
    - `'{"version":1,"lastSeenMonth":"2026-13"}'`
    - `'{"version":1,"lastSeenMonth":202610}'`
  - When 홈 진입(today '2026-10-11')
  - Then `loadMeta()`는 null이고, Toast 없이 `pcm.meta.v1`이 `{ version: 1, lastSeenMonth: '2026-10' }`으로 저장된다.
  - And `'{"version":1,"lastSeenMonth":null}'`은 유효한 값으로 읽히며, 같은 방식으로 Toast 없이 '2026-10'이 저장된다.
  - And `console.error` 호출은 0회다.
- AC-7 [U][P1]: Scenario: 검수 — 호환성·콘솔 에러
  - Given 프로덕션 빌드
  - When 소스 정적 검사와 홈·설정·항목 화면 E2E 순회를 실행
  - Then `crypto.randomUUID`, `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter`는 0건이다.
  - And 외부 분석 SDK import는 0건이다.
  - And 순회 중 `console.error` 호출은 0회다.
- AC-8 [W][P1]: Scenario: 메타 저장 실패
  - Given 픽스처 BASE, `pcm.meta.v1 = { version: 1, lastSeenMonth: '2026-10' }`, today '2026-11-02'이고, saveMeta가 `{ ok: false, error: 'quota' }`를 돌려준다.
  - When 홈 진입
  - Then 홈은 정상 렌더된다: calendar-grid 2026-11, lowest-day-card, schedule-list.
  - And Toast "11월 달력으로 넘어왔어요"는 표시되지만, 저장 실패를 알리는 에러 Toast는 표시되지 않는다. 이 Toast는 저장 성공 알림이 아니라 보는 달이 바뀌었다는 안내다. 메타는 사용자 데이터가 아니고 실패해도 결과가 달라지지 않으므로 알리지 않는다.
  - And `console.error` 호출은 0회다.
  - And `pcm.meta.v1`은 '2026-10'으로 남는다. 그래서 다음 진입 때 새 달 Toast가 다시 표시될 수 있으며, 이는 허용한다.
- AC-9 [W][P1]: Scenario: 메타 저장의 알 수 없는 실패
  - Given F7-AC-8과 같은 조건이고, saveMeta가 `{ ok: false, error: 'unknown' }`을 돌려준다.
  - When 홈 진입
  - Then F7-AC-8과 같다.
    - 홈 정상 렌더
    - Toast "11월 달력으로 넘어왔어요" 1회
    - 에러 Toast 0회
    - `pcm.meta.v1`은 '2026-10' 유지
    - `console.error` 0회

## Screen Definitions

### S0. 앱 공통 — 라우팅과 저장소 가드
- **라우트**
  ```tsx
  <StorageGuard>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/items" element={<Items />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </StorageGuard>
  ```
- **StorageGuard**
  - 첫 렌더 전에 `probeStorage()`를 1회 호출한다.
  - false면 라우트 대신 저장소 사용 불가 상태(F4-AC-11)를 렌더한다. 별도 경로가 아니라 같은 화면 안의 상태다.
  - '다시 시도'를 탭할 때만 다시 확인한다.
- **정의되지 않은 경로**: F4-AC-12.

### S1. 홈 — 잔고 달력 (`/`)
- **Top title**: "텅장달력". 우측에 텍스트 버튼 '월급·잔고'가 있다.
- **골격**: PageShell > ScreenScaffold. 하단에 FloatingTabBar(탭: '달력' `/`, '출금 항목' `/items`).
- **구성**(위→아래)
  1. TDS Tab: '이번 달 (10월)' / '다음 달 (11월)'
  2. `data-testid="free-tier"`
     - stale-balance-row(조건부)
     - lowest-day-card: Card + SummaryHero(CountUp) + Badge + 크런치 문구 + Sparkline
     - Spacing size={16}
     - calendar-grid: Card + CSS grid 7열, 칸 최소 48×48px
     - Spacing size={16}
     - schedule-list: ListRow 목록
  3. AdSlot 배너
  4. `data-testid="sim-section"`
     - `data-testid="locked-teaser"`: 게이트 바깥이다. Paragraph.Text 2줄이며, locked-tier가 마운트되면 숨긴다.
     - `<TossRewardAd>` > `data-testid="locked-tier"`: 제목 Paragraph.Text, sim-row ListRow들, 안내 Paragraph.Text.
  5. display="block" Button '내 잔고 달력 공유하기'
- **BottomSheet**: 날짜 상세(F4-AC-4), 출금일 바꿔보기(F6-AC-5. TextField numeric + Button display="block". 29~31 안내 F6-AC-10).
- **결과 계층화**
  - **무료 층**: 최저 잔고일 카드, 날짜별 잔고 달력, 항목별 출금 일정. 이것만으로 "언제 잔고가 바닥나는가"라는 앱의 목적이 달성된다. `data-testid="free-tier"`.
  - **잠금 층**: 항목별 최적 이동일과 최저 잔고 증가액, 직접 날짜 비교·저장. `data-testid="locked-tier"`.
  - **코드 구조 규칙**: 무료 층과 locked-teaser는 `<TossRewardAd>` 바깥에 두고, 잠금 층만 그 자식으로 둔다. 화면 전체를 감싸지 않는다. 잠금 해제 상태는 컴포넌트 세션 상태로만 두고 저장하지 않는다.
- **상태**
  - 로딩: localStorage 동기 읽기라 별도 스피너는 없다. 첫 렌더 전에 load를 끝낸다.
  - 광고 로딩: F6-AC-11. free-tier는 기다리지 않고, sim-section에는 locked-teaser만 보인다.
  - 광고 취소: F6-AC-12. 광고 실패·타임아웃: F6-AC-13.
  - 빈 상태: F4-AC-5(출금 0개), F7-AC-5(기준일 62일 초과).
  - 에러:
    - F4-AC-6(설정 없음·손상·버전 불일치 → /setup)
    - F4-AC-9(출금 항목 손상 → Toast)
    - F4-AC-11(저장소 접근 불가)
    - F6-AC-7·F6-AC-15(시뮬레이션 저장 실패)
    - F7-AC-6(메타 손상, 무음 덮어쓰기)
    - F7-AC-8·F7-AC-9(메타 저장 실패, 무음)
- **터치**: 달력 칸 ≥48px, ListRow·Button은 TDS 기본 높이(≥44px), Tab 항목 ≥44px.
- **스크롤**: 페이지 세로 스크롤 하나다. 항목 최대 30개이므로 가상 스크롤은 없다.
- **Navigation state contract**
  - Incoming: `location.state = null`(사용하지 않음). `*` 리다이렉트로 들어와도 같다.
  - Outgoing:
    - 설정 없음 → `navigate('/setup', { replace: true, state: { mode: 'onboarding' } as SetupLocationState })`
    - Top '월급·잔고' → `navigate('/setup', { state: { mode: 'edit' } as SetupLocationState })`
    - stale-balance-row·'지금 잔고 입력' → `navigate('/setup', { state: { mode: 'edit', focus: 'balance' } as SetupLocationState })`
    - '출금 항목 추가'(빈 상태) → `navigate('/items', { state: { openAdd: true } as ItemsLocationState })`
- **Instrumentation contract**
  - logImpression: `'lowest_day_card'`(카드 첫 노출), `'banner_calendar'`(배너 노출), `'sim_locked_tier'`(잠금 층 열림)
  - logClick: `'share_calendar'`(공유 Button), `'sim_save_day'`(시뮬레이션 '이 날짜로 저장', 버튼이 활성일 때 탭)
  - 공유는 `shareApp()`을 쓴다. `requestReviewOnce()`는 시뮬레이션 날짜 저장이 성공한 뒤에만 호출하며, 실패하면 무음 처리한다(F6-AC-14).
- **Layout AC**: F4-AC-2(calendar-grid), F5-AC-1(lowest-day-card), F6-AC-2(locked-tier sim-row).

### S2. 월급·잔고 설정 (`/setup`)
- **Top title**: onboarding이면 "텅장달력 시작하기", edit이면 "월급·잔고 설정".
- **골격**: PageShell > ScreenScaffold. FloatingTabBar는 숨긴다. SubmitFooter(onboarding '다음', edit '저장')를 둔다.
- **구성**
  - TextField '월급 실수령액'(numeric, 접미 '원')
  - TextField '월급일'(numeric, 접미 '일', 1~31)
  - Paragraph.Text '월급일이 주말이면' + Chip(ChipItem '그대로' / '직전 평일' / '다음 평일')
  - TextField '지금 통장 잔고'(numeric, 접미 '원', 도움말 "오늘 나간 돈·들어온 돈이 반영된 잔고를 넣어주세요")
  - edit 모드면 Paragraph.Text '잔고 기준일: {M}월 {D}일'
  - 각 블록 사이에 Spacing size={24}
- **저장 값**: `{ version: 1, salaryAmount, salaryDay, salaryWeekendRule, currentBalance, balanceAsOf }` 6개 키(F2-AC-1).
- **상태**
  - 빈 상태·빈 필드: F2-AC-6(onboarding), F2-AC-10(edit)
  - 검증 에러: F2-AC-3·4·9
  - 저장 에러: F2-AC-5(quota), F2-AC-11(unknown)
  - 미저장 입력: F2-AC-12
  - 로딩은 동기다.
- **키보드**: F2-AC-7. SubmitFooter는 키보드 위에 고정된다.
- **Navigation state contract**
  - Incoming: `location.state: SetupLocationState | null`
    ```ts
    type SetupLocationState = { mode: 'onboarding' | 'edit'; focus?: 'balance' };
    ```
    - null이면 저장된 설정 유무로 mode를 정한다(있으면 'edit'). mode가 'edit'인데 설정이 없으면 'onboarding'으로 처리한다.
  - Outgoing:
    - onboarding 저장 → `navigate('/items', { state: { from: 'onboarding' } as ItemsLocationState })`
    - edit 저장 → `navigate('/', { replace: true })`
    - 저장 실패 시에는 이동하지 않는다.
- **Instrumentation contract**: logClick `'setup_save'`(SubmitFooter 버튼, 검증 통과 시).

### S3. 출금 항목 (`/items`)
- **Top title**: "출금 항목".
- **골격**: PageShell > ScreenScaffold.
  - `from: 'onboarding'`이면 FloatingTabBar 대신 SubmitFooter '달력 보기'를 둔다. 항목 0개여도 활성이며 `navigate('/', { replace: true })`로 이동한다.
  - 그 외에는 FloatingTabBar를 둔다.
- **구성**
  - outflow-total: Paragraph.Text + MiniBar. 설정이 없으면 비율을 생략한다.
  - Spacing size={16}
  - Button '출금 추가'(display="block", variant weak)
  - 항목 ListRow 목록(F3-AC-7 정렬. 표시만 정렬하고 저장 순서는 바꾸지 않는다)
- **BottomSheet**: 항목 추가/수정 공용.
  - TextField '이름'(maxLength 20, placeholder "예: 월세")
  - ChipItem 이름 프리셋 5개(추가 모드만)
  - TextField '금액'(numeric, '원')
  - TextField '매월 출금일'(numeric, '일')
  - Chip '주말이면'
  - Button display="block" '추가하기'/'저장하기'. 이름·금액·출금일 중 하나라도 빈 값('')이면 `disabled`다(F3-AC-9).
  - 수정 모드에는 Button color danger variant weak '삭제'를 추가한다.
  - 시트 본문은 스크롤되고, 포커스된 필드는 scrollIntoView로 키보드에 가리지 않는다.
- **저장 규칙**
  - 추가: `{ id: 새 id, name: trim된 이름, amount, day, weekendRule }`을 `items` 끝에 붙인다(F3-AC-1).
  - 수정: `applyDayChangeToItem`(F1-AC-13)으로 만든 항목에 이름·금액·주말 처리를 반영한 뒤 같은 인덱스에 교체한다(F3-AC-2·12).
  - 삭제: 해당 인덱스 항목만 제거한다(F3-AC-3).
- **AlertDialog**: 삭제 확인(F3-AC-3).
- **상태**
  - 빈 상태: F3-AC-4
  - 검증: F3-AC-5, F3-AC-9
  - 상한: F3-AC-6
  - 저장 실패: F3-AC-8(quota), F3-AC-10(unknown)
  - 미저장 입력: F3-AC-11
  - 로딩은 동기다.
- **스크롤**: 최대 30행, 페이지 스크롤.
- **터치**: ListRow·ChipItem·Button 모두 ≥44px.
- **Navigation state contract**
  - Incoming: `location.state: ItemsLocationState | null`
    ```ts
    type ItemsLocationState = { from?: 'onboarding'; openAdd?: boolean };
    ```
    - `openAdd: true`면 진입 직후 추가 시트를 연다. 30개 상한이면 F3-AC-6의 Toast를 띄운다.
    - 처리 직후 `navigate('.', { replace: true, state: { ...state, openAdd: false } })`로 state를 비운다(F3-AC-11).
  - Outgoing: onboarding '달력 보기' → `navigate('/', { replace: true })`.
- **Instrumentation contract**: logClick `'outflow_add_submit'`(시트 '추가하기', 검증 통과 시).
- **공용 타입 위치**: `SetupLocationState`, `ItemsLocationState`는 `src/types/nav.ts`에 두고 보내는 쪽과 받는 쪽이 같은 타입을 import한다.

## Assumptions
- 입력한 '지금 통장 잔고'는 오늘 출금·입금이 이미 반영된 값이다. 그래서 balanceAsOf 당일 이벤트는 투영에서 뺀다.
- 정기 입금은 월급 1건(매월 1회)뿐이다. 그 외에는 사용자가 등록한 매월 출금만 계산한다. 일회성 출금과 부수입은 범위 밖이다(OQ-5).
- 영업일 판정은 토·일만 제외한다. 공휴일은 반영하지 않는다(OQ-2).
- 같은 날 입금·출금이 겹치면 출금이 먼저 나간다고 보수적으로 계산한다. 은행별 실제 처리 순서는 확인하지 않았다.
- 29~31일 출금은 그 날짜가 없는 달에 말일로 계산한다(OQ-3). 시뮬레이션 직접 입력도 1~31을 받고 같은 규칙으로 계산한다. 추천(bestShifts) 후보만 1~28일이다.
- 출금 금액은 날짜를 옮겨도 그대로라고 본다. 카드 결제일을 바꾸면 이용 기간이 달라져 청구액이 바뀔 수 있으나 계산하지 않는다(OQ-8).
- 시뮬레이션 구간은 오늘부터 다음 달 말일까지다.
- 리워드 게이트 해제는 세션 동안만 유지하고 저장하지 않는다. 새 저장 스키마는 없다.
- **저장 스키마 버전**
  - 이 SPEC은 `.v1` 키만 정의한다. 아직 배포된 이전 스키마가 없으므로 v1 안의 마이그레이션은 없다.
  - 개발 중 빌드가 남긴 버전 없는 배열 형태의 `pcm.outflows.v1`은 손상으로 보고 지운다(F1-AC-6).
  - 저장 값에는 시각 필드(`updatedAt`·`createdAt`)를 두지 않는다. 어디서도 읽지 않으며, 같은 날 출금의 순서는 `items` 배열 순서(등록 순)로 정한다.
  - 향후 스키마가 바뀌면 새 키(`.v2`)를 쓰고 v1 키는 남겨 둔다. 그래서 배포를 되돌려도 v1 앱이 자기 데이터를 읽는다. `.v1` 키 안의 `version !== 1`은 손상으로 처리한다.
- **광고 실패 시 잠금 층 열림(확정 정책)**: 광고 로드 실패, 타임아웃, 슬롯 ID 미설정이면 템플릿 TossRewardAd가 게이트를 자동으로 연다. 이 SPEC은 이 동작을 의도된 정책으로 승인한다.
  - 근거 ①: 잠금 층은 사용자의 출금일 결정을 돕는 정보다. 광고를 못 보여 준다는 이유로 영원히 닫아 두면 사용자에게 손해다.
  - 근거 ②: 템플릿 컴포넌트를 재설계하지 않는다는 프로젝트 규칙이 있다.
  - 근거 ③: 현재 빌드에는 슬롯 ID가 없어서, 닫힌 채로 실패하게 만들면 잠금 층이 아예 보이지 않는다.
  - 감수하는 점: 네트워크를 끊으면 광고 없이 열 수 있다. 이 수익 손실은 감수한다.
  - 사용자가 광고를 직접 닫은 경우(취소)는 실패가 아니므로 열리지 않는다(F6-AC-12).
- 광고 로딩 표시와 타임아웃 시간은 템플릿 TossRewardAd의 기본 동작을 따른다.
- 저장 실패는 `quota`와 `unknown`을 같은 Toast로 알리고, 사용자가 할 수 있는 행동은 '다시 시도'뿐이다.
  - 앱 데이터는 10KB 미만이라 `quota`는 같은 저장소를 쓰는 다른 데이터가 공간을 다 쓴 드문 경우다.
  - 앱은 다른 데이터를 지울 수 없으므로 저장 공간 확보 안내는 넣지 않는다(OQ-9).
- localStorage 접근 자체가 막히면 앱을 쓸 수 없다고 안내한다(F4-AC-11). 저장하지 않는 메모리 전용 모드는 만들지 않는다.
- 저장하지 않은 폼·시트 입력은 WebView 재로드 시 사라진다. 백그라운드 복귀만으로는 사라지지 않는다.
- 잔고 입력은 0 이상이다. 마이너스 통장의 음수 잔고는 받지 않으며, '-' 입력은 안내 없이 무시된다(OQ-4).
- `requestReviewOnce()`의 실패·거부는 사용자에게 알리지 않는다.
- `VITE_TOSS_AD_GROUP_ID`, `VITE_TOSS_AD_SLOT_ID`는 빌드 시점에 주입된다. 현재 빌드에는 값이 없으므로 배너는 비고 리워드 게이트는 자동으로 열린다. 값을 바꾸면 재빌드·재배포가 필요하다.
- 금액은 원 단위 정수이고 통화는 KRW 하나다.

## Open Questions
1. **주말 처리 기본값의 출처**: 카드 결제일·자동이체·급여일이 토·일이면 실제로 직전 평일과 다음 평일 중 언제 처리되는지 근거를 확인하지 못해 기본값을 '그대로'로 두었다. 후보 근거는 각 카드사 회원약관, 은행 자동이체 약관, 회사 취업규칙이다. 출처가 확인되면 항목 시트의 기본값을 바꿀까? 현재 '앱이 더하는 것'은 날짜 보정과 탐색 계산뿐이고, 공개 기준 인용은 없다.
2. **공휴일 반영**: 「관공서의 공휴일에 관한 규정」 기준 공휴일을 연도별 정적 데이터로 넣을까? 대체·임시공휴일 때문에 매년 갱신이 필요하다.
3. **말일 보정**: 29~31일 자동이체가 짧은 달에 말일로 처리되는 것이 실제 은행 처리와 같은가, 아니면 다음 달 1일로 넘어가는가?
4. **마이너스 통장 지원**: 음수 잔고 입력과 한도 표시를 지원할까? 지원하지 않는다면 잔고 필드에 "마이너스 잔고는 아직 입력할 수 없어요" 같은 도움말을 둘까?
5. **기타 입출금**: 월급 외 정기 입금(부수입·용돈)이나 일회성 출금(예: 경조사비)을 받을까? PRD 범위 밖이라 제외했다.
6. **시뮬레이션 범위**: 추천 후보일 1~28일 제한과 '오늘부터 다음 달 말일' 구간이 적절한가?
7. **설계 노트(구현하지 않음)**: 잠금 층을 990원 일회성 IAP로 여는 안이 있다. SKU가 콘솔 발급값이고, 결제는 SKU가 없으면 영원히 닫히는 비대칭이 있어 리워드 게이트만 쓴다.
8. **카드 결제일 변경 안내**: 결제일을 옮기면 청구 금액이 달라질 수 있다는 점을 시뮬레이션 안내 문구에 추가할까? 근거 문서가 필요하다.
9. **저장 공간 부족 안내**: `quota` 실패 때 '다시 시도' 외의 안내(예: 토스 앱 캐시 정리)를 넣을까? 토스 WebView에서 사용자가 실제로 할 수 있는 조치를 확인해야 한다.
10. **광고 실패 열림 정책 재검토 시점**: 광고 채움률 데이터가 생긴 뒤 F6-AC-13 정책을 다시 볼까? 템플릿 수정이 필요하면 별도 결정이 필요하다.
11. **미래 날짜 잔고 기준일**: 기기 시계를 되돌려 `balanceAsOf`가 today보다 늦어진 경우를 어떻게 처리할까? 현재 로드 검증은 형식과 실재하는 날짜만 확인하므로 이 값은 유효로 통과한다. 이때의 달력 표시는 정의되어 있지 않다.