# Sprint Contract — 패킷 0019
<!-- 파이프라인이 이 패킷을 위해 생성(순수 생성 콜) — 다른 패킷의 계약서가 아니다 -->

## Sprint Contract: 라우팅 + 전역 Provider + StorageGuard 배선

**만들 항목**
- `src/components/StorageGuard.tsx`: 첫 렌더 전에 `probeStorage`를 1회 호출한다. `false`면 `data-testid='storage-unavailable'` 화면만 렌더한다(Top '텅장달력', Asset.ContentIcon, '저장 공간을 쓸 수 없어 달력을 만들 수 없어요', '다시 시도'). '다시 시도'는 재probe하며, 여전히 `false`면 Toast '아직 저장 공간을 쓸 수 없어요'를 띄우고 같은 상태에 머문다. `true`면 원래 경로를 렌더한다.
- `src/App.tsx`: 전체를 StorageGuard로 감싸고 그 안에 AppDataProvider를 둔다. Route는 `/`(Home), `/setup`(Setup), `/items`(Items), `*`(`<Navigate to='/' replace />`). FloatingTabBar는 `/`와 `/items`에서만 렌더한다.
- `src/App.test.tsx`: 완료 조건 1~4를 검증하는 테스트를 작성한다.

**사용할 TypeScript 타입**
- `src/lib/types.ts`에서 `PaySettings`, `OutflowStore`, `AppMeta`를 import하여 AppDataProvider 값 타입에 사용한다. 새 도메인 타입은 정의하지 않는다.

**검증 방법**
- probe false 시 `/`, `/setup`, `/items` 진입 모두 `storage-unavailable`만 렌더되고 FloatingTabBar·AdSlot·TossRewardAd가 0개인지 확인한다.
- '다시 시도' 실패 시 Toast 1회 노출, `/setup` 미이동, `console.error` 0회인지 확인한다. 성공 시 `/`에서 lowest-day-card가 보이는지 확인한다.
- BASE 저장 상태에서 `/result`, `/foo/bar` 진입 시 pathname이 `/`가 되고 홈이 렌더되며, `replace`로 뒤로 가기 시 `/result`로 돌아가지 않고 Toast가 0회인지 확인한다.
- FloatingTabBar가 `/`, `/items`에서 '달력', '출금 항목' 각 1개, `/setup`에서 0개인지 확인한다.
- `git diff src/main.tsx` 결과가 0줄인지 확인한다.

**절대 하면 안 되는 것**
- `src/main.tsx` 수정 금지(diff 0줄 유지).
- 패킷 범위 밖 파일 수정 금지. `src/App.tsx`, `StorageGuard.tsx`, `App.test.tsx`만 변경한다.
- StorageGuard에서 `/setup`으로 리다이렉트하거나 `console.error`를 호출하지 않는다.
- `probeStorage`를 첫 렌더 이후나 여러 번 호출하지 않는다(재시도 제외).
- `types.ts`에 런타임 코드나 새 도메인 타입을 추가하지 않는다.
