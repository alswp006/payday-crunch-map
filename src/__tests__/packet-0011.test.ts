import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  mockTds,
  mockAnalytics,
  mockLogClick,
  mockOpenToast,
  mockNavigate,
} from "@/__tests__/__helpers__/mocks";
import { BASE } from "@/test/fixtures";
import { SETTINGS_KEY } from "@/lib/store/keys";
import { AppDataProvider } from "@/state/AppDataContext";
import Setup from "@/pages/Setup";

mockTds();
mockAnalytics();

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// 저장 계층: 기본은 실제 saveSettings를 그대로 부르고, 실패 경로만 테스트에서 덮는다.
const { saveSettingsSpy } = vi.hoisted(() => ({ saveSettingsSpy: vi.fn() }));
vi.mock("@/lib/store/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/save")>();
  saveSettingsSpy.mockImplementation(actual.saveSettings);
  return { ...actual, saveSettings: saveSettingsSpy };
});

type RouteState = { mode: "onboarding" | "edit"; focus?: "balance" };

function setToday(iso: string) {
  vi.setSystemTime(new Date(`${iso}T09:00:00+09:00`));
}

function ui(state: RouteState) {
  return React.createElement(
    MemoryRouter,
    { initialEntries: [{ pathname: "/setup", state }] },
    React.createElement(AppDataProvider, null, React.createElement(Setup)),
  );
}

function renderSetup(state: RouteState) {
  return render(ui(state));
}

const salary = () => screen.getByLabelText(/월급 실수령액/) as HTMLInputElement;
const day = () => screen.getByLabelText(/월급일/) as HTMLInputElement;
const balance = () => screen.getByLabelText(/잔고/) as HTMLInputElement;

function type(el: HTMLInputElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

function fillAll(s: string, d: string, b: string) {
  type(salary(), s);
  type(day(), d);
  type(balance(), b);
}

function button(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function storedSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw === null ? null : JSON.parse(raw);
}

let setItemSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday("2026-10-11");
  mockNavigate.mockReset();
  mockOpenToast.mockReset();
  mockLogClick.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  setItemSpy = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  setItemSpy.mockRestore();
  saveSettingsSpy.mockClear();
});

describe("월급·잔고 설정 페이지 (/setup) + 폼 훅", () => {
  it("AC-1[P0]: onboarding은 빈 칸·'그대로' 선택·'다음' disabled로 시작하고, 입력 후 저장하면 BASE.settings가 저장되고 /items로 이동한다", () => {
    renderSetup({ mode: "onboarding" });

    expect(salary().value).toBe("");
    expect(day().value).toBe("");
    expect(balance().value).toBe("");
    expect(screen.getByRole("button", { name: "그대로", pressed: true })).toBeInTheDocument();
    expect(button("다음").disabled).toBe(true);

    fillAll("2500000", "25", "800000");
    expect(salary().value).toBe("2,500,000");
    expect(button("다음").disabled).toBe(false);

    fireEvent.click(button("다음"));

    expect(storedSettings()).toEqual(BASE.settings);
    expect(mockLogClick).toHaveBeenCalledTimes(1);
    expect(mockLogClick).toHaveBeenCalledWith("setup_save");
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/items", { state: { from: "onboarding" } });
  });

  it("AC-2[P0]: edit에서 월급만 바꾸면 balanceAsOf가 유지되고 Toast 후 홈으로 replace 이동한다", () => {
    setToday("2026-10-20");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    renderSetup({ mode: "edit" });

    expect(salary().value).toBe("2,500,000");
    expect(day().value).toBe("25");
    expect(balance().value).toBe("800,000");

    type(salary(), "2700000");
    fireEvent.click(button("저장"));

    expect(storedSettings()).toEqual({ ...BASE.settings, salaryAmount: 2700000, balanceAsOf: "2026-10-11" });
    expect(mockOpenToast).toHaveBeenCalledWith("저장했어요");
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-2[P0]: edit에서 잔고를 바꾸면 balanceAsOf가 오늘로 갱신된다", () => {
    setToday("2026-10-20");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    renderSetup({ mode: "edit" });

    type(balance(), "1000000");
    fireEvent.click(button("저장"));

    expect(storedSettings()).toEqual({ ...BASE.settings, currentBalance: 1000000, balanceAsOf: "2026-10-20" });
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-3[P1]: 범위를 벗어난 값은 문구를 보이고 쓰기 0회, 잔고 '0'은 0으로 저장된다", () => {
    renderSetup({ mode: "onboarding" });

    fillAll("2500000", "32", "800000");
    fireEvent.click(button("다음"));
    expect(screen.getByText("1~31 사이 날짜를 입력해주세요")).toBeInTheDocument();

    type(day(), "0");
    fireEvent.click(button("다음"));
    expect(screen.getByText("1~31 사이 날짜를 입력해주세요")).toBeInTheDocument();

    fillAll("0", "25", "800000");
    fireEvent.click(button("다음"));
    expect(screen.getByText("0원보다 큰 금액을 입력해주세요")).toBeInTheDocument();

    fillAll("1000000001", "25", "800000");
    fireEvent.click(button("다음"));
    expect(screen.getByText("10억 원 이하로 입력해주세요")).toBeInTheDocument();

    fillAll("2500000", "25", "10000000000");
    fireEvent.click(button("다음"));
    expect(screen.getByText("잔고는 9,999,999,999원 이하로 입력해주세요")).toBeInTheDocument();

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();

    fillAll("2500000", "25", "0");
    fireEvent.click(button("다음"));
    expect(storedSettings()).toEqual({ ...BASE.settings, currentBalance: 0 });
  });

  it("AC-4[P1]: edit에서 필드를 비우고 blur하면 문구가 보이고 저장이 막히며 Enter도 쓰기 0회다", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    setItemSpy.mockClear();
    renderSetup({ mode: "edit" });

    type(salary(), "");
    fireEvent.blur(salary());
    expect(screen.getByText("월급 실수령액을 입력해주세요")).toBeInTheDocument();
    expect(button("저장").disabled).toBe(true);

    fireEvent.keyDown(balance(), { key: "Enter" });
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(storedSettings().salaryAmount).toBe(2500000);

    type(salary(), "2500000");
    expect(screen.queryByText("월급 실수령액을 입력해주세요")).toBeNull();
    expect(button("저장").disabled).toBe(false);

    type(day(), "");
    fireEvent.blur(day());
    expect(screen.getByText("월급일을 입력해주세요")).toBeInTheDocument();
    expect(button("저장").disabled).toBe(true);
    type(day(), "25");

    type(balance(), "");
    fireEvent.blur(balance());
    expect(screen.getByText("지금 잔고를 입력해주세요")).toBeInTheDocument();
    expect(button("저장").disabled).toBe(true);
    fireEvent.keyDown(balance(), { key: "Enter" });
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("AC-5[P1]: 저장 실패(quota·unknown)면 Toast를 띄우고 이동하지 않으며 입력값이 유지된다", () => {
    for (const error of ["quota", "unknown"] as const) {
      mockNavigate.mockReset();
      mockOpenToast.mockReset();
      const { unmount } = renderSetup({ mode: "onboarding" });
      fillAll("2500000", "25", "800000");

      saveSettingsSpy.mockReturnValueOnce({ ok: false, error });
      fireEvent.click(button("다음"));

      expect(mockOpenToast).toHaveBeenCalledWith("저장하지 못했어요. 다시 시도해주세요");
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(salary().value).toBe("2,500,000");
      expect(day().value).toBe("25");
      expect(balance().value).toBe("800,000");
      expect(screen.getByRole("button", { name: "그대로", pressed: true })).toBeInTheDocument();
      unmount();
    }
  });

  it("AC-8[P2]: focus 'balance'면 잔고 필드가 포커스되고 잔고 기준일 안내가 보인다", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
    renderSetup({ mode: "edit", focus: "balance" });

    expect(document.activeElement).toBe(balance());
    expect(screen.getByText("잔고 기준일: 10월 11일")).toBeInTheDocument();
  });

  it("AC-12[P2]: visibilitychange 뒤에도 미저장 입력이 유지되고, 재마운트하면 빈 값이며 Toast는 없다", () => {
    const { unmount } = renderSetup({ mode: "onboarding" });
    type(salary(), "2500000");
    type(day(), "25");

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(salary().value).toBe("2,500,000");
    expect(day().value).toBe("25");

    unmount();
    renderSetup({ mode: "onboarding" });

    expect(salary().value).toBe("");
    expect(day().value).toBe("");
    expect(balance().value).toBe("");
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(mockOpenToast).not.toHaveBeenCalled();
  });
});
