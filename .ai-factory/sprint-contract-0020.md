# Sprint Contract — 패킷 0020
<!-- 파이프라인이 이 패킷을 위해 생성(순수 생성 콜) — 다른 패킷의 계약서가 아니다 -->

**Sprint Contract: 최종 폴리시 (정적 감사 + 핵심 여정·리워드 게이트 테스트)**

- **만들 항목 (테스트 파일 3개만 추가)**
  - `src/test/staticAudit.test.ts`: `src/**/*.{ts,tsx,css}`에서 테스트 파일(`*.test.*`, `src/test/**`)을 제외하고 검사. F4-AC-8(HEX 정규식, `window.open(`, `location.href = 'http`, '설치'·'다운로드') 및 F7-AC-7(`crypto.randomUUID`, `structuredClone`, `.at(`, `Object.hasOwn`, `Intl.Segmenter`, react-ga·@amplitude·firebase/analytics import) 각 0건 단언
  - `src/test/journey.test.tsx`: today `2026-10-11`, 빈 저장소로 App 렌더 → /setup(2500000·25·800000) '다음' → /items BASE 4개 추가 → 하단 '달력' 탭 → `day-cell-2026-10-24`에 '월세'·'-25.2만', `lowest-day-card`에 '-252,000원' 단언
  - `src/test/rewardGate.test.tsx`: `VITE_TOSS_AD_SLOT_ID` 미설정, BASE 홈 진입 → free-tier(`lowest-day-card` '10월 24일 (토)'·'-252,000원', `calendar-grid`, `schedule-list`) 표시, `sim-row` 4개 자동 열림, 실패 Toast 0개, `logImpression('sim_locked_tier')` 1회 단언
- **사용할 타입**: `src/lib/types.ts`에서 import만 (`PaySettings`, `OutflowStore`, `Outflow`, `AppMeta`, `WeekendRule`, `LocalDate`, `YearMonth`). 재정의 금지
- **검증 방법**
  - `npx vitest run` 전체 통과, 실행 중 `console.error` spy 호출 0회
  - 정적 감사 위반 0건 확인. 위반 시 파일:줄 번호 출력
  - `beforeEach`에서 localStorage·mock 초기화해 테스트 순서와 무관하게 통과
- **절대 하면 안 되는 것**
  - `src/App.tsx`, `src/main.tsx` 수정
  - 새 광고·결제 컴포넌트 생성 (기존 AdSlot, TossRewardAd 그대로 사용)
  - 제품 코드 변경, `skip`/`only`, eslint-disable, 기대값 완화로 테스트 통과시키기
