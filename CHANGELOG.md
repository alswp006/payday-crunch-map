# Changelog

## [0.1.0] - 2026-10-10

20/20 packets completed.

### Added
- feat: 도메인 타입 + RouteState 계약 정의 (packet 0001)
- feat: 테스트 환경 + BASE 픽스처 + 전역 셋업 (packet 0002)
- feat: 날짜·금액 포맷 유틸 (getToday, localDate, format) (packet 0003)
- feat: 저장소 어댑터 + save 계열 + probeStorage + id 생성 (packet 0004)
- feat: 읽을 때 검증기 + load 계열 (손상 복구·버전 불일치·30개 상한) (packet 0005)
- feat: 잔고 계산 엔진 코어 (날짜 보정·월 이벤트·투영·월 요약) (packet 0006)
- feat: 출금일 변경 적용 시점 (applyDayChange, applyDayChangeToItem) (packet 0007)
- feat: 출금일 이동 시뮬레이션 + 홈 화면 모델 selector (packet 0008)
- feat: 앱 데이터 상태 Context (AppDataProvider + 액션) (packet 0009)
- feat: 숫자 입력 필드 NumericField (공용 컴포넌트) (packet 0010)
- feat: 월급·잔고 설정 페이지 (/setup) + 폼 훅 (packet 0011)
- feat: 출금 항목 BottomSheet (추가·수정 공용 OutflowSheet) (packet 0012)
- feat: 출금 항목 페이지 (/items) + 목록 (packet 0013)
- feat: 잔고 달력 그리드 + 날짜 상세 시트 (packet 0014)
- feat: 출금 일정 목록 + 최저 잔고일 카드 + 공유 버튼 (packet 0015)
- feat: 출금일 바꿔보기 BottomSheet (ShiftSheet) (packet 0016)
- feat: 시뮬레이션 섹션 (teaser + 리워드 게이트 + 잠금 층 목록) (packet 0017)
- feat: 홈 페이지 조립 (/) + 월 이월 훅 (packet 0018)
- feat: 라우팅 + 전역 Provider + StorageGuard 배선 (App.tsx 단일 소유) (packet 0019)
- feat: 최종 폴리시 — 검수 정적 감사 + 핵심 여정·리워드 게이트 통합 테스트 (packet 0020)
