// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StorageGuard } from './components/StorageGuard';
import { FloatingTabBar } from './components/FloatingTabBar';
import type { TabItem } from './components/FloatingTabBar';
import { AppDataProvider } from './state/AppDataContext';
import type { ItemsRouteState } from './types/nav';
import Home from './pages/Home';
import Setup from './pages/Setup';
import Items from './pages/Items';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

const TABS: TabItem[] = [
  { label: '달력', path: '/' },
  { label: '출금 항목', path: '/items' },
];

/** 탭바는 탭-루트 화면('/', '/items')에서만 그린다. /setup·리다이렉트 중인 경로에는 없다. */
const TAB_PATHS = new Set(TABS.map((t) => t.path));

export default function App() {
  const location = useLocation();
  // 온보딩 중인 /items는 하단 '달력 보기' SubmitFooter가 1차 CTA라 탭바를 겹쳐 그리지 않는다.
  const onboarding = (location.state as ItemsRouteState | null)?.from === 'onboarding';
  const showTabs = TAB_PATHS.has(location.pathname) && !onboarding;

  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    // StorageGuard가 false면 Provider·라우트·탭바·광고를 하나도 그리지 않는다(F4-AC-11).
    <StorageGuard>
      <AppDataProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/items" element={<Items />} />
          {DevTdsGallery && (
            <Route
              path="/__tds-gallery"
              element={
                <Suspense fallback={null}>
                  <DevTdsGallery />
                </Suspense>
              }
            />
          )}
          {/* 미정의 경로 → 홈. NotFound 화면이 설계에 생기면 이 줄을 그 화면으로 바꿔라. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {showTabs ? (
          <>
            {/* 고정 탭바에 가려지는 본문 끝을 스크롤로 끌어올릴 수 있게 탭바 높이만큼 자리를 둔다. */}
            <div aria-hidden style={{ height: 'calc(64px + var(--toss-safe-area-bottom))' }} />
            <FloatingTabBar items={TABS} />
          </>
        ) : null}
      </AppDataProvider>
    </StorageGuard>
  );
}
