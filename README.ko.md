🇰🇷 [English](./README.md)

# 텅장달력 (Payday Crunch Map) — 월급 전에 잔액이 가장 얇아지는 날을 찾아요

텅장달력은 잔액이 날짜별로 어떻게 변할지 미리 보여주는 토스 미니앱(앱인토스)이에요. 실수령액, 월급날, 현재 잔액을 입력하고 월세, 카드값, 구독료처럼 매달 빠져나가는 돈을 등록하면, 예상 잔액을 달력에 찍고 월급 전 가장 잔액이 적은 날(크런치)을 강조해 줘요. 고정지출이 월급날 직전에 몰리는지 확인하고 싶은 월급쟁이를 위한 앱이며, 모든 데이터는 기기 안에만 저장돼요.

## 기능

- 📅 **잔액 달력**: 이번 달과 다음 달의 매일 예상 최저 잔액을 보여줘요.
- 📉 **최저 잔액일 카드**: 이번 달에서 잔액이 가장 낮은 날을 스파크라인과 함께 강조하고, 잔액이 마이너스면 부족 금액을 알려줘요.
- 🔍 **날짜 상세**: 달력의 날짜를 누르면 그날 들어오는 월급과 나가는 돈을 보여줘요.
- 🗒️ **일정 목록**: 이번 달의 월급과 출금 일정을 날짜순으로 나열해요.
- 💰 **월급·잔액 설정**: 실수령액, 월급날(주말 처리: 그대로, 전 영업일, 다음 영업일), 특정 날짜 기준 잔액을 입력해요.
- 🔄 **잔액 갱신 안내**: 잔액 기준일이 지난달이면 잔액을 갱신하라고 알리고, 62일이 넘으면 예상값을 숨겨요.
- 🧾 **출금 항목**: 반복 출금을 최대 30개까지 추가·수정·삭제할 수 있어요. 항목마다 이름(20자 이내), 금액, 매달 며칠, 주말 처리 방식을 정해요.
- 🗓️ **적용 월 기준 날짜 변경**: 출금일을 바꾸면 다음 달부터 적용돼서, 지난 예상치는 바뀌지 않아요.
- 🎯 **결제일 시뮬레이션**: 출금 항목마다 더 나은 결제일을 찾아 비교하고, 새 날짜를 저장할 수 있어요. 이 기능은 리워드 광고를 보면 열려요.
- 📤 **공유**: 잔액 달력을 홈 화면으로 연결되는 딥링크와 함께 공유해요.
- 🆕 **새 달 알림**: 새 달에 처음 앱을 열면 한 번 토스트로 알려줘요.
- 📊 **사용 로그**: 앱인토스 `Analytics` SDK로 화면 조회와 주요 버튼 클릭을 기록해요.

## 기술 스택

- **프레임워크**: React 18 + TypeScript, Vite 6로 빌드한 정적 클라이언트 번들
- **라우팅**: React Router 7 (`react-router-dom`)
- **UI**: Toss Design System (`@toss/tds-mobile`, `@toss/tds-mobile-ait`, `@toss/tds-colors`), `lucide-react` 아이콘, `@emotion/react` / `@emotion/styled`
- **플랫폼 SDK**: `@apps-in-toss/web-framework` (햅틱, 공유, 리뷰 요청, 분석, 배너·리워드 광고)
- **저장소**: 브라우저 `localStorage`만 사용 (서버·데이터베이스 없음)
- **인증**: 없음. 토스 로그인을 요구하지 않아요.
- **테스트**: jsdom과 Testing Library를 쓰는 Vitest, 비주얼 스모크 테스트는 Playwright

## 시작하기

요구 사항: Node.js와 npm. 이 프로젝트는 pnpm이 아니라 npm을 써요.

```bash
# 의존성 설치
npm install

# 프로덕션 번들 (dist/에 출력)
npx vite build

# 토스 미니앱 번들
npx ait build
```

테스트는 `npx vitest run`, 비주얼 스모크 테스트는 `npm run test:visual`로 실행해요.

## 환경 변수

`.env.example`을 `.env`로 복사한 뒤 앱인토스 콘솔에서 발급받은 값을 채워 넣어요. Vite가 빌드할 때 값을 치환하므로, 값을 바꾸면 다시 빌드해야 해요. 값을 비워 두면 해당 기능만 꺼져요.

| 변수 | 설명 | 필수 |
|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | 홈 화면에 보이는 배너 광고 그룹 ID. 없으면 배너를 그리지 않아요. | 아니요 |
| `VITE_TOSS_AD_SLOT_ID` | 결제일 시뮬레이션을 여는 리워드 전면 광고 슬롯 ID. 없으면 게이트가 자동으로 열려요. | 아니요 |
| `VITE_SHARE_OG_URL` | 공유 링크에 붙는 미리보기 이미지 URL. 없으면 미리보기 이미지를 붙이지 않아요. | 아니요 |
| `VITE_TOSS_IAP_SKU` | `TossPurchase` 컴포넌트가 읽는 인앱결제 SKU. 이 컴포넌트는 어떤 화면에도 마운트되어 있지 않아요. | 아니요 |

소스 코드에 임시 ID를 하드코딩하지 마세요. 콘솔에서 받은 값은 반드시 이 변수들을 통해 넣어야 해요.

## 프로젝트 구조

```
src/
├── pages/        # Screens: Home (calendar), Setup (salary and balance), Items (withdrawals)
├── components/   # Shared UI wrappers (ads, tab bar, storage guard) plus home/, items/, form/ subfolders
├── lib/          # Pure logic: balance/ (projection engine), date/, store/ (load, save, validate), analytics, review, share
├── state/        # AppDataProvider context that holds settings, withdrawals, and metadata
├── types/        # Route state types shared between screens
├── styles/       # Global and ad CSS
├── test/         # Integration and audit tests
└── __tests__/    # Unit and packet tests
e2e/              # Playwright visual smoke tests and screenshots
scripts/          # Build-time checks (forbidden patterns, dev-code leak, finish gate)
```

## 배포

1. 프로덕션 빌드를 위해 `.env`에 `VITE_*` 값을 채워요.
2. `apps-in-toss.config.ts`의 `appName`(`payday-crunch-map`)이 앱인토스 콘솔에 등록된 앱 이름과 대소문자까지 정확히 일치하는지 확인해요. 일치하지 않으면 4031 오류로 배포가 실패해요.
3. `npx ait build`를 실행해 토스 CDN에 올릴 번들을 만들어요. 정적 빌드이므로 서버 사이드 렌더링은 쓸 수 없어요.
4. 앱인토스 개발자 콘솔에서 빌드를 업로드하고 검수를 요청해요. 토스는 출시 가이드라인에 따라 앱을 검수해요. 콘솔에서 검수 상태와 피드백을 확인하고, 지적된 문제를 고친 뒤 다시 제출하세요.

## 라이선스

MIT
