import { test, expect } from '@playwright/test';

// nightcrew Sentinel smoke 팩 — Factory 산출(§7.1)
// 핵심 막: 월급일·금액과 본인이 등록한 출금 항목(이름·금액·날짜)을 입력하고 항목은 자유롭게 추가·삭제, 등록한 항목이 달력에 자기 이름으로 찍히고 날짜별 예상 잔고를 표시, 예상 잔고가 가장 낮은 날과 월급 전 최저 구간을 강조, 출금일을 옮기면 최저 잔고가 얼마나 달라지는지 시뮬레이션(리워드 광고 뒤 공개), 다음 달 달력으로 자동 이월
// 토스 브릿지 의존 구간(로그인·결제)은 외부 재현 불가 — 화면 도달 확인까지만.
const ROUTES = ["/","/Home.test","/Home","/Items.test","/Items"];
// WebView 밖 실행에서만 나는 콘솔 에러는 무시(앱인토스 관례 — toss visual-smoke 템플릿 계승)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /granite/i, /apps-in-toss/i];

for (const route of ROUTES) {
  test(`smoke: ${route} 렌더링과 콘솔 에러 없음`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
