import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  mockTds,
  mockAnalytics,
  mockLogClick,
  mockOpenToast,
  mockRequestReviewOnce,
} from "@/__tests__/__helpers__/mocks";
import { BASE, BASE_TODAY } from "@/test/fixtures";
import { OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";
import { AppDataProvider } from "@/state/AppDataContext";
import { ShiftSheet } from "@/components/home/ShiftSheet";

mockTds();
mockAnalytics();

// 저장 계층: 기본은 실제 saveOutflows를 그대로 부르고, 실패 경로만 테스트에서 덮는다.
const { saveOutflowsSpy } = vi.hoisted(() => ({ saveOutflowsSpy: vi.fn() }));
vi.mock("@/lib/store/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/save")>();
  saveOutflowsSpy.mockImplementation(actual.saveOutflows);
  return { ...actual, saveOutflows: saveOutflowsSpy };
});

const RENT = { id: "o-rent", name: "월세", amount: 550000, day: 28, weekendRule: "none" };

function storedOutflows(): Array<Record<string, unknown>> {
  return JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? "{}").items;
}

function renderSheet(onClose = vi.fn()) {
  const ui = React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      AppDataProvider,
      null,
      React.createElement(ShiftSheet, {
        open: true,
        itemId: "o-rent",
        settings: BASE.settings,
        outflows: BASE.outflows,
        today: BASE_TODAY,
        onClose,
      }),
    ),
  );
  return { onClose, ...render(ui) };
}

function dayInput(): HTMLInputElement {
  return screen.getByLabelText(/바꿀 날짜/) as HTMLInputElement;
}

function typeDay(value: string) {
  fireEvent.change(dayInput(), { target: { value } });
}

const COMPARE = "지금 최저 -252,000원 → 바꾸면 298,000원 (+550,000원)";
const SAVE_LABEL = "이 날짜로 저장";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  mockRequestReviewOnce.mockReset();
  saveOutflowsSpy.mockClear();
});

describe("출금일 바꿔보기 BottomSheet (ShiftSheet)", () => {
  it("AC-1[P0]: 기본값은 bestShifts의 toDay 26이고, 28을 입력하면 비교 문구가 보인다", () => {
    renderSheet();

    expect(screen.getByText("출금일 바꿔보기")).toBeInTheDocument();
    expect(dayInput().value).toBe("26");
    expect(screen.getByText("지금 최저 -252,000원 → 바꾸면 298,000원 (+550,000원)")).toBeInTheDocument();

    typeDay("28");
    expect(dayInput().value).toBe("28");
    expect(screen.getByText(COMPARE)).toBeInTheDocument();
    // 1~28일에는 말일 안내가 없다.
    expect(screen.queryByText("29~31일은 그 날짜가 없는 달에 말일로 계산해요")).toBeNull();
  });

  it("AC-1[P0]: 저장하면 항목·Toast·로그·리뷰 요청·닫힘이 모두 일어난다", () => {
    const { onClose } = renderSheet();
    typeDay("28");
    fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));

    const items = storedOutflows();
    expect(items[0]).toEqual(RENT);
    expect(Object.prototype.hasOwnProperty.call(items[0], "dayChange")).toBe(false);
    expect(items).toHaveLength(4);
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("월세 출금일을 28일로 바꿨어요");
    expect(mockLogClick).toHaveBeenCalledTimes(1);
    expect(mockLogClick).toHaveBeenCalledWith("sim_save_day");
    expect(mockRequestReviewOnce).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("AC-2[P0]: 0·32·빈 값이면 오류 문구가 보이고 비교 문구가 숨겨지며 저장이 막힌다", () => {
    renderSheet();
    const save = () => screen.getByRole("button", { name: SAVE_LABEL });

    typeDay("0");
    expect(screen.getByText("1~31 사이 날짜를 입력해주세요")).toBeInTheDocument();
    expect(screen.queryByText(/지금 최저/)).toBeNull();
    expect(save()).toBeDisabled();

    typeDay("32");
    expect(screen.getByText("1~31 사이 날짜를 입력해주세요")).toBeInTheDocument();
    expect(screen.queryByText(/지금 최저/)).toBeNull();
    expect(save()).toBeDisabled();

    typeDay("");
    expect(screen.getByText("바꿀 날짜를 입력해주세요")).toBeInTheDocument();
    expect(screen.queryByText(/지금 최저/)).toBeNull();
    expect(save()).toBeDisabled();

    // 버튼·Enter 모두 저장을 일으키지 않는다.
    fireEvent.click(save());
    fireEvent.keyDown(dayInput(), { key: "Enter" });
    expect(saveOutflowsSpy).toHaveBeenCalledTimes(0);
    expect(mockLogClick).toHaveBeenCalledTimes(0);
    expect(storedOutflows()[0]).toMatchObject({ id: "o-rent", day: 24 });

    // 26을 다시 넣으면 원래대로 돌아온다.
    typeDay("26");
    expect(screen.queryByText("바꿀 날짜를 입력해주세요")).toBeNull();
    expect(screen.queryByText("1~31 사이 날짜를 입력해주세요")).toBeNull();
    expect(screen.getByText(COMPARE)).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("AC-3[P1]: 31을 입력하면 비교 문구와 말일 안내가 함께 보이고 dayChange 없이 저장된다", () => {
    renderSheet();
    typeDay("31");

    expect(screen.getByText(COMPARE)).toBeInTheDocument();
    expect(screen.getByText("29~31일은 그 날짜가 없는 달에 말일로 계산해요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
    expect(storedOutflows()[0]).toEqual({ ...RENT, day: 31 });
    expect(mockOpenToast).toHaveBeenCalledWith("월세 출금일을 31일로 바꿨어요");
  });

  it.each([
    ["quota", { ok: false, error: "quota" }],
    ["unknown", { ok: false, error: "unknown" }],
  ])("AC-4[P1]: 저장이 %s로 실패하면 실패 Toast만 뜨고 day는 24로 남는다", (_name, failure) => {
    saveOutflowsSpy.mockImplementationOnce(() => failure);
    const { onClose } = renderSheet();
    typeDay("28");
    fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("저장하지 못했어요. 다시 시도해주세요");
    expect(storedOutflows()[0]).toMatchObject({ id: "o-rent", day: 24 });
    expect(mockLogClick).toHaveBeenCalledTimes(1);
    expect(mockLogClick).toHaveBeenCalledWith("sim_save_day");
    expect(mockRequestReviewOnce).toHaveBeenCalledTimes(0);
    // 시트는 열린 채 입력한 값이 남는다.
    expect(onClose).toHaveBeenCalledTimes(0);
    expect(dayInput().value).toBe("28");
  });

  it("AC-5[P2]: requestReviewOnce가 reject해도 Toast는 1개이고 console.error는 0회다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    mockRequestReviewOnce.mockImplementation(() => Promise.reject(new Error("review rejected")));

    const { onClose } = renderSheet();
    typeDay("28");
    fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
    await new Promise((r) => setTimeout(r, 0));
    process.off("unhandledRejection", unhandled);

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("월세 출금일을 28일로 바꿨어요");
    expect(storedOutflows()[0]).toEqual(RENT);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(0);
    expect(unhandled).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });

  it("AC-5[P2]: requestReviewOnce가 동기 throw해도 Toast는 1개이고 시트가 닫힌다", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRequestReviewOnce.mockImplementation(() => {
      throw new Error("bridge missing");
    });

    const { onClose } = renderSheet();
    typeDay("28");
    fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("월세 출금일을 28일로 바꿨어요");
    expect(storedOutflows()[0]).toEqual(RENT);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(0);
    errorSpy.mockRestore();
  });
});
