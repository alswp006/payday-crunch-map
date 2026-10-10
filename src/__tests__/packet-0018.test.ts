import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import {
  mockTds,
  mockAnalytics,
  mockNavigate,
  mockOpenToast,
  mockLogImpression,
} from "@/__tests__/__helpers__/mocks";
import { BASE } from "@/test/fixtures";
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";
import { AppDataProvider, useAppData } from "@/state/AppDataContext";
import type { SaveResult } from "@/lib/types";
import Home from "@/pages/Home";

mockTds();
mockAnalytics();

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// 메타 저장 실패를 흉내 낸다 — null이면 실제 저장을 그대로 부른다.
const { metaFailure, loadFullScreenAd, showFullScreenAd, attachBanner } = vi.hoisted(() => ({
  metaFailure: { current: null as SaveResult | null },
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
  attachBanner: vi.fn(),
}));

vi.mock("@/lib/store/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/save")>();
  return {
    ...actual,
    saveMeta: (meta: Parameters<typeof actual.saveMeta>[0]) => metaFailure.current ?? actual.saveMeta(meta),
  };
});

vi.mock("@apps-in-toss/web-framework", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apps-in-toss/web-framework")>();
  return {
    ...actual,
    loadFullScreenAd,
    showFullScreenAd,
    generateHapticFeedback: vi.fn(),
    TossAds: {
      ...actual.TossAds,
      initialize: Object.assign(vi.fn(), { isSupported: () => true }),
      attachBanner: Object.assign(attachBanner, { isSupported: () => true }),
    },
  };
});

const AD_GROUP = "ad-group-from-console";
const NEXT_MONTH_TOAST = "11월 달력으로 넘어왔어요";
const EMPTY_TEXT = "출금 항목을 등록하면 잔고가 얇아지는 날을 찍어드려요";

function UpdateBalance() {
  const { saveSettings } = useAppData();
  return React.createElement(
    "button",
    {
      onClick: () =>
        saveSettings({ ...BASE.settings, currentBalance: 1500000, balanceAsOf: "2026-11-02" }),
    },
    "test-update-balance",
  );
}

function renderHome() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(
        AppDataProvider,
        null,
        React.createElement(Home),
        React.createElement(UpdateBalance),
      ),
    ),
  );
}

function setToday(iso: string) {
  vi.setSystemTime(new Date(`${iso}T09:00:00+09:00`));
}

function seed(opts: { outflows?: unknown[]; meta?: unknown } = {}) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(
    OUTFLOWS_KEY,
    JSON.stringify({ version: 1, items: opts.outflows ?? BASE.outflows }),
  );
  if (opts.meta !== undefined) localStorage.setItem(META_KEY, JSON.stringify(opts.meta));
}

function cell(date: string) {
  return screen.getByTestId(`day-cell-${date}`);
}

function scheduleRowCount(): number {
  const list = screen.getByTestId("schedule-list");
  return list.querySelectorAll('[data-slot="top"]').length;
}

function impressionCount(name: string): number {
  return mockLogImpression.mock.calls.filter((c) => c[0] === name).length;
}

function toastTexts(): unknown[] {
  return mockOpenToast.mock.calls.map((c) => c[0]);
}

function isBefore(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday("2026-10-11");
  metaFailure.current = null;
  mockNavigate.mockClear();
  mockOpenToast.mockClear();
  mockLogImpression.mockClear();
  loadFullScreenAd.mockReset();
  showFullScreenAd.mockReset();
  attachBanner.mockReset();
  vi.stubEnv("VITE_TOSS_AD_GROUP_ID", AD_GROUP);
  vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "slot-from-console");
  // 카드가 화면에 들어온 것으로 본다 — 노출 로그 단언용.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private cb: (entries: { isIntersecting: boolean }[]) => void;
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.cb = cb;
      }
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe("홈 페이지 조립 (/) + 월 이월 훅", () => {
  it("AC-1[P0]: BASE 홈에 월세 칸·최저 잔고일 카드가 보이고 AdSlot은 schedule-list 아래, sim-section 위, free-tier 바깥이다", async () => {
    seed();
    renderHome();

    expect(cell("2026-10-24")).toHaveTextContent("월세");
    expect(cell("2026-10-24")).toHaveTextContent("-25.2만");

    const card = screen.getByTestId("lowest-day-card");
    expect(card).toHaveTextContent("10월 24일 (토)");
    await waitFor(() => expect(card).toHaveTextContent("-252,000원"));
    expect(impressionCount("lowest_day_card")).toBe(1);
    expect(screen.getByRole("button", { name: "내 잔고 달력 공유하기" })).toBeInTheDocument();

    const freeTier = screen.getByTestId("free-tier");
    const list = screen.getByTestId("schedule-list");
    const sim = screen.getByTestId("sim-section");
    const ad = document.querySelector(`[data-ad-group-id="${AD_GROUP}"]`) as HTMLElement;
    expect(ad).not.toBeNull();
    expect(isBefore(list, ad)).toBe(true);
    expect(isBefore(ad, sim)).toBe(true);
    expect(freeTier.contains(ad)).toBe(false);
    expect(freeTier.contains(sim)).toBe(false);
    expect(freeTier.contains(list)).toBe(true);
    expect(freeTier.contains(screen.getByTestId("calendar-grid"))).toBe(true);
    expect(scheduleRowCount()).toBe(5);
  });

  it("AC-1[P0]: 배너 광고가 실패해도 lowest-day-card·calendar-grid·schedule-list가 렌더되고 오류 문구는 없다", () => {
    attachBanner.mockImplementation(() => {
      throw new Error("no fill");
    });
    seed();
    renderHome();

    expect(screen.getByTestId("lowest-day-card")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-grid")).toBeInTheDocument();
    expect(screen.getByTestId("schedule-list")).toBeInTheDocument();
    expect(attachBanner).toHaveBeenCalled();
    expect(screen.queryByText(/광고.*(못|실패|오류)/)).toBeNull();
    expect(toastTexts()).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: 출금이 0개면 빈 상태만 보이고 카드·공유·sim-section·광고 게이트·노출 로그가 없다", () => {
    seed({ outflows: [] });
    renderHome();

    const freeTier = screen.getByTestId("free-tier");
    expect(within(freeTier).getByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId("lowest-day-card")).toBeNull();
    expect(screen.queryByRole("button", { name: "내 잔고 달력 공유하기" })).toBeNull();
    expect(screen.queryByTestId("sim-section")).toBeNull();
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
    expect(loadFullScreenAd).not.toHaveBeenCalled();
    expect(impressionCount("lowest_day_card")).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "출금 항목 추가" }));
    expect(mockNavigate).toHaveBeenCalledWith("/items", { state: { openAdd: true } });
  });

  it("AC-3[P0]: 설정이 없거나 손상됐으면 /setup 온보딩으로 replace 이동한다(손상일 때만 안내 Toast)", () => {
    // 키 없음 — recovered: false
    renderHome();
    expect(mockNavigate).toHaveBeenCalledWith("/setup", { replace: true, state: { mode: "onboarding" } });
    expect(toastTexts()).toEqual([]);
    expect(screen.queryByTestId("lowest-day-card")).toBeNull();
  });

  it("AC-3[P0]: 설정 값이 손상돼 지워졌으면(recovered: true) 같은 경로로 이동하고 안내 Toast를 1회 띄운다", () => {
    localStorage.setItem(SETTINGS_KEY, "{bad");
    renderHome();

    expect(mockNavigate).toHaveBeenCalledWith("/setup", { replace: true, state: { mode: "onboarding" } });
    expect(toastTexts().filter((t) => t === "저장된 정보를 불러오지 못해 다시 입력이 필요해요")).toHaveLength(1);
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
  });

  it("AC-3[P1]: '다음 달 (11월)' Tab을 누르면 grid가 11월로 바뀌고 11-24에 119.6만, schedule-list에 5행이 보인다", () => {
    seed();
    renderHome();
    expect(screen.getAllByTestId(/^day-cell-/)).toHaveLength(31);

    fireEvent.click(screen.getByRole("tab", { name: "다음 달 (11월)" }));

    expect(screen.getAllByTestId(/^day-cell-/)).toHaveLength(30);
    expect(screen.queryByTestId("day-cell-2026-10-24")).toBeNull();
    expect(cell("2026-11-24")).toHaveTextContent("월세");
    expect(cell("2026-11-24")).toHaveTextContent("119.6만");
    expect(scheduleRowCount()).toBe(5);
  });

  it("AC-4[P0]: 새 달이면 Tab 라벨이 바뀌고 Toast를 1회 띄운 뒤 meta를 2026-11로 저장한다", () => {
    setToday("2026-11-02");
    seed({ meta: { version: 1, lastSeenMonth: "2026-10" } });
    renderHome();

    expect(screen.getByRole("tab", { name: "이번 달 (11월)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "다음 달 (12월)" })).toBeInTheDocument();
    expect(screen.getByTestId("day-cell-2026-11-24")).toBeInTheDocument();
    expect(screen.queryByTestId("day-cell-2026-10-24")).toBeNull();
    expect(toastTexts().filter((t) => t === NEXT_MONTH_TOAST)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
      version: 1,
      lastSeenMonth: "2026-11",
    });
  });

  it("AC-4[P1]: 같은 달을 이미 봤으면 Toast가 없다", () => {
    setToday("2026-11-02");
    seed({ meta: { version: 1, lastSeenMonth: "2026-11" } });
    renderHome();

    expect(screen.getByRole("tab", { name: "이번 달 (11월)" })).toBeInTheDocument();
    expect(toastTexts()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
      version: 1,
      lastSeenMonth: "2026-11",
    });
  });

  it.each([
    ["quota", { ok: false, error: "quota" }],
    ["unknown", { ok: false, error: "unknown" }],
  ] as const)(
    "AC-4[P0]: meta 저장이 %s로 실패해도 홈은 정상이고 에러 Toast·console.error는 0회다",
    (_name, failure) => {
      setToday("2026-11-02");
      seed({ meta: { version: 1, lastSeenMonth: "2026-10" } });
      metaFailure.current = failure as SaveResult;
      renderHome();

      expect(screen.getByTestId("day-cell-2026-11-24")).toBeInTheDocument();
      expect(screen.getByTestId("lowest-day-card")).toBeInTheDocument();
      expect(screen.getByTestId("schedule-list")).toBeInTheDocument();
      expect(toastTexts()).toEqual([NEXT_MONTH_TOAST]);
      expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
        version: 1,
        lastSeenMonth: "2026-10",
      });
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it("AC-5[P1]: 기준일이 지난달이면 stale-balance-row가 보이고 탭하면 설정(잔고)으로 이동하며, 잔고를 갱신하면 사라진다", async () => {
    setToday("2026-11-02");
    seed({ meta: { version: 1, lastSeenMonth: "2026-11" } });
    renderHome();

    const row = screen.getByTestId("stale-balance-row");
    expect(row).toHaveTextContent("잔고 기준일이 10월 11일이에요");
    expect(row).toHaveTextContent("지금 잔고로 바꾸기");

    fireEvent.click(within(row).getByText("지금 잔고로 바꾸기"));
    expect(mockNavigate).toHaveBeenCalledWith("/setup", { state: { mode: "edit", focus: "balance" } });

    fireEvent.click(screen.getByRole("button", { name: "test-update-balance" }));
    expect(screen.queryByTestId("stale-balance-row")).toBeNull();
    const card = screen.getByTestId("lowest-day-card");
    await waitFor(() => expect(card).toHaveTextContent("448,000원"));
    expect(card).toHaveTextContent("11월 24일 (화)");
  });

  it("AC-5[P1]: 기준일이 63일 지나면 잔고 숫자·카드·sim-section이 없고 '지금 잔고 입력'이 보이며, 62일이면 잔고가 보인다", () => {
    setToday("2026-12-13");
    seed({ meta: { version: 1, lastSeenMonth: "2026-12" } });
    const first = renderHome();

    expect(screen.getByText("잔고 기준일이 너무 오래됐어요 (10월 11일)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 잔고 입력" })).toBeInTheDocument();
    expect(screen.queryByTestId("lowest-day-card")).toBeNull();
    expect(screen.queryByTestId("sim-section")).toBeNull();
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
    expect(screen.queryByTestId("locked-tier")).toBeNull();
    const balanceTexts = screen
      .getAllByTestId(/^day-cell-/)
      .map((el) => el.textContent ?? "")
      .filter((t) => /\d만/.test(t));
    expect(balanceTexts).toEqual([]);

    first.unmount();
    setToday("2026-12-12");
    renderHome();
    expect(screen.queryByText(/너무 오래됐어요/)).toBeNull();
    expect(screen.getByTestId("lowest-day-card")).toBeInTheDocument();
    expect(screen.getByTestId("sim-section")).toBeInTheDocument();
  });
});
