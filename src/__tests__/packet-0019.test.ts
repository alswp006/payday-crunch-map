import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { execSync } from "node:child_process";
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAnalytics, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { BASE } from "@/test/fixtures";
import { OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";
import App from "@/App";

mockTds();
mockAnalytics();

// 이 테스트는 실제 라우팅(pathname, replace)을 본다 — useNavigate는 목킹하지 않는다.

const { probe } = vi.hoisted(() => ({ probe: vi.fn<() => boolean>() }));

vi.mock("@/lib/store/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/storage")>();
  return { ...actual, probeStorage: () => probe() };
});

// 광고 컴포넌트는 존재 여부만 센다.
vi.mock("@/components/AdSlot", () => ({
  AdSlot: () => React.createElement("div", { "data-testid": "ad-slot" }),
}));
vi.mock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "reward-ad" }, children),
  default: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "reward-ad" }, children),
}));

const seen = { pathname: "", navType: "" };

function LocationProbe() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  seen.pathname = location.pathname;
  seen.navType = navType;
  return React.createElement(
    "button",
    { "data-testid": "probe-back", onClick: () => navigate(-1) },
    "probe-back",
  );
}

function renderAt(path: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(App),
      React.createElement(LocationProbe),
    ),
  );
}

function seed() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
}

function tabBars() {
  return screen.queryAllByRole("tablist");
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  probe.mockReset();
  probe.mockReturnValue(true);
  mockOpenToast.mockClear();
  seen.pathname = "";
  seen.navType = "";
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("라우팅 + 전역 Provider + StorageGuard 배선 (App.tsx 단일 소유)", () => {
  it.each(["/", "/setup", "/items"])(
    "AC-1[P0]: probeStorage가 false이면 %s 진입에도 storage-unavailable 화면만 렌더된다",
    (path) => {
      probe.mockReturnValue(false);
      seed();
      renderAt(path);

      const guard = screen.getByTestId("storage-unavailable");
      expect(within(guard).getByText("저장 공간을 쓸 수 없어 달력을 만들 수 없어요")).toBeInTheDocument();
      expect(within(guard).getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
      expect(screen.getByText("텅장달력")).toBeInTheDocument();
      expect(guard.querySelectorAll("[data-content-icon]").length).toBe(1);
      expect(tabBars()).toHaveLength(0);
      expect(screen.queryAllByTestId("ad-slot")).toHaveLength(0);
      expect(screen.queryAllByTestId("reward-ad")).toHaveLength(0);
      expect(screen.queryByTestId("lowest-day-card")).toBeNull();
      expect(seen.pathname).toBe(path);
    },
  );

  it("AC-1[P0]: probeStorage는 첫 렌더에서 1회만 호출된다", () => {
    seed();
    renderAt("/");
    expect(probe).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("storage-unavailable")).toBeNull();
  });

  it("AC-2[P0]: 다시 시도가 여전히 false면 Toast를 띄우고 같은 상태에 머문다", () => {
    probe.mockReturnValue(false);
    seed();
    renderAt("/");

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast.mock.calls[0][0]).toBe("아직 저장 공간을 쓸 수 없어요");
    expect(screen.getByTestId("storage-unavailable")).toBeInTheDocument();
    expect(seen.pathname).toBe("/");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: 다시 시도가 true가 되면 원래 경로(홈)를 렌더하고 /setup으로 가지 않는다", () => {
    probe.mockReturnValue(false);
    seed();
    renderAt("/");

    probe.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(screen.queryByTestId("storage-unavailable")).toBeNull();
    expect(screen.getByTestId("lowest-day-card")).toBeInTheDocument();
    expect(seen.pathname).toBe("/");
    expect(mockOpenToast).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(["/result", "/foo/bar"])(
    "AC-3[P0]: BASE 저장 상태에서 %s 진입은 replace로 '/'가 되고 홈이 렌더된다",
    (path) => {
      seed();
      renderAt(path);

      expect(seen.pathname).toBe("/");
      expect(seen.navType).toBe("REPLACE");
      expect(screen.getByTestId("lowest-day-card")).toBeInTheDocument();
      expect(mockOpenToast).not.toHaveBeenCalled();

      // 뒤로 가기를 눌러도 /result로 돌아가지 않는다.
      fireEvent.click(screen.getByTestId("probe-back"));
      expect(seen.pathname).toBe("/");
    },
  );

  it("AC-4[P1]: '/'와 '/items'에는 FloatingTabBar(달력, 출금 항목)가 1개, '/setup'에는 0개다", () => {
    seed();
    const home = renderAt("/");
    expect(tabBars()).toHaveLength(1);
    expect(within(tabBars()[0]).getByRole("tab", { name: "달력" })).toBeInTheDocument();
    expect(within(tabBars()[0]).getByRole("tab", { name: "출금 항목" })).toBeInTheDocument();
    home.unmount();

    const items = renderAt("/items");
    expect(tabBars()).toHaveLength(1);
    expect(within(tabBars()[0]).getByRole("tab", { name: "출금 항목" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    items.unmount();

    renderAt("/setup");
    expect(seen.pathname).toBe("/setup");
    expect(tabBars()).toHaveLength(0);
  });

  it("AC-4[P1]: src/main.tsx의 diff는 0줄이다", () => {
    const diff = execSync("git diff HEAD --numstat -- src/main.tsx", { encoding: "utf8" });
    expect(diff.trim()).toBe("");
  });
});
