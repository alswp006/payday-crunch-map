import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import {
  mockTds,
  mockAnalytics,
  mockOpenToast,
  mockLogImpression,
} from "@/__tests__/__helpers__/mocks";
import { BASE, BASE_TODAY } from "@/test/fixtures";
import { OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";
import { AppDataProvider } from "@/state/AppDataContext";
import { SimSection } from "@/components/home/SimSection";

mockTds();
mockAnalytics();

// 광고 SDK: 템플릿 TossRewardAd는 이 두 함수를 부른다. 테스트마다 동작을 갈아 끼운다.
const { loadFullScreenAd, showFullScreenAd } = vi.hoisted(() => ({
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
}));
vi.mock("@apps-in-toss/web-framework", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apps-in-toss/web-framework")>()),
  loadFullScreenAd,
  showFullScreenAd,
  generateHapticFeedback: vi.fn(),
}));

type AdCallbacks = { onEvent?: (e: { type: string }) => void; onError?: (e: unknown) => void };

const ROW_IDS = ["o-rent", "o-card", "o-phone", "o-netflix"];
const IMPRESSION = "sim_locked_tier";
const TEASER_TITLE = "항목별로 가장 유리한 출금일을 찾아드려요";
const TEASER_SUB = "광고를 끝까지 보면 열려요";

function renderSection(outflows = BASE.outflows) {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AppDataProvider,
        null,
        React.createElement(SimSection, { settings: BASE.settings, outflows, today: BASE_TODAY }),
      ),
    ),
  );
}

function impressionCount(): number {
  return mockLogImpression.mock.calls.filter((c) => c[0] === IMPRESSION).length;
}

function rowTexts(id: string) {
  const row = screen.getByTestId(`sim-row-${id}`);
  const top = row.querySelector('[data-slot="top"]')?.textContent;
  const bottom = row.querySelector('[data-slot="bottom"]')?.textContent;
  return { row, top, bottom };
}

function snapshotStorage(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) as string;
    out[key] = localStorage.getItem(key);
  }
  return out;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
  loadFullScreenAd.mockReset();
  showFullScreenAd.mockReset();
  mockOpenToast.mockClear();
  mockLogImpression.mockClear();
  vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "slot-from-console");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("시뮬레이션 섹션 (teaser + 리워드 게이트 + 잠금 층 목록)", () => {
  it("AC-1[P0]: 광고를 끝까지 보면 locked-tier에 제목과 sim-row 4개가 순서대로 열리고 teaser는 사라진다", async () => {
    loadFullScreenAd.mockImplementation((o: AdCallbacks) => {
      setTimeout(() => o.onEvent?.({ type: "loaded" }), 0);
    });
    showFullScreenAd.mockImplementation((o: AdCallbacks) => {
      setTimeout(() => o.onEvent?.({ type: "rewarded" }), 0);
    });
    renderSection();

    const watch = await screen.findByRole("button", { name: "광고 보고 확인하기" });
    await waitFor(() => expect(watch).toBeEnabled());
    fireEvent.click(watch);

    const tier = await screen.findByTestId("locked-tier");
    expect(within(tier).getByText("출금일을 옮기면")).toBeInTheDocument();
    const ids = Array.from(tier.querySelectorAll('[data-testid^="sim-row-"]')).map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual(ROW_IDS.map((id) => `sim-row-${id}`));

    const rent = rowTexts("o-rent");
    expect(rent.top).toBe("월세 24일 → 26일");
    expect(rent.bottom).toBe("최저 잔고 +550,000원");
    expect(rowTexts("o-card")).toMatchObject({ top: "카드값 14일 → 26일", bottom: "+420,000원" });
    expect(rowTexts("o-phone")).toMatchObject({ top: "통신비 21일 → 26일", bottom: "+65,000원" });
    expect(rowTexts("o-netflix")).toMatchObject({ top: "넷플릭스 18일 → 26일", bottom: "+17,000원" });

    expect(impressionCount()).toBe(1);
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
    expect(screen.queryByText(TEASER_SUB)).toBeNull();
  });

  it("AC-2[P1]: 이미 가장 유리한 날짜면 화살표 없이 '지금 날짜가 가장 유리해요' / '변화 없음 (0원)'", () => {
    vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "");
    renderSection([{ id: "o-rent", name: "월세", amount: 550000, day: 26, weekendRule: "none" }]);

    const rent = rowTexts("o-rent");
    expect(rent.top).toBe("월세 26일 · 지금 날짜가 가장 유리해요");
    expect(rent.bottom).toBe("변화 없음 (0원)");
    expect(rent.row.textContent).not.toContain("→");
    expect(screen.getAllByTestId(/^sim-row-/)).toHaveLength(1);
  });

  it("AC-3[P1]: 광고 로드가 pending이면 teaser만 보이고 locked-tier·impression은 없다", () => {
    loadFullScreenAd.mockImplementation(() => {
      // 콜백을 영영 부르지 않는다 — 로드 중.
    });
    renderSection();

    const teaser = screen.getByTestId("locked-teaser");
    expect(within(teaser).getByText(TEASER_TITLE)).toBeInTheDocument();
    expect(within(teaser).getByText(TEASER_SUB)).toBeInTheDocument();
    expect(screen.getByTestId("sim-section")).toContainElement(teaser);
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    expect(screen.queryAllByTestId(/^sim-row-/)).toHaveLength(0);
    expect(impressionCount()).toBe(0);
    expect(loadFullScreenAd).toHaveBeenCalledTimes(1);
    expect(loadFullScreenAd.mock.calls[0][0]).toMatchObject({ slotId: "slot-from-console" });
  });

  it("AC-4[P1]: 보상 전에 광고를 닫으면 teaser가 유지되고 Toast·저장·impression이 0회다", async () => {
    loadFullScreenAd.mockImplementation((o: AdCallbacks) => {
      setTimeout(() => o.onEvent?.({ type: "loaded" }), 0);
    });
    // 광고를 띄웠다가 보상 콜백 없이 닫힘 — 어떤 이벤트도 오지 않는다.
    showFullScreenAd.mockImplementation(() => {});
    const before = snapshotStorage();
    renderSection();

    const watch = await screen.findByRole("button", { name: "광고 보고 확인하기" });
    await waitFor(() => expect(watch).toBeEnabled());
    fireEvent.click(watch);

    expect(showFullScreenAd).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    expect(screen.getByText(TEASER_SUB)).toBeInTheDocument();
    expect(mockOpenToast).toHaveBeenCalledTimes(0);
    expect(impressionCount()).toBe(0);
    expect(snapshotStorage()).toEqual(before);
  });

  it("AC-5[P1]: slotId가 비어 있으면 광고 호출 없이 게이트가 열리고 sim-row 4개·impression 1회, Toast 0회", () => {
    vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "");
    renderSection();

    expect(screen.getByTestId("locked-tier")).toBeInTheDocument();
    const ids = screen.getAllByTestId(/^sim-row-/).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual(ROW_IDS.map((id) => `sim-row-${id}`));
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
    expect(loadFullScreenAd).not.toHaveBeenCalled();
    expect(impressionCount()).toBe(1);
    expect(mockOpenToast).toHaveBeenCalledTimes(0);
    expect(screen.queryByText(/실패|오류|못했어요/)).toBeNull();
  });

  it("AC-5[P1]: 광고 로드가 실패해도 게이트가 자동으로 열리고 실패 문구 없이 impression 1회", async () => {
    loadFullScreenAd.mockImplementation((o: AdCallbacks) => {
      setTimeout(() => o.onError?.(new Error("offline")), 0);
    });
    renderSection();

    const tier = await screen.findByTestId("locked-tier");
    expect(within(tier).getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(rowTexts("o-rent").top).toBe("월세 24일 → 26일");
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
    expect(screen.queryByText(/실패|오류|못했어요/)).toBeNull();
    expect(mockOpenToast).toHaveBeenCalledTimes(0);
    expect(impressionCount()).toBe(1);
  });
});
