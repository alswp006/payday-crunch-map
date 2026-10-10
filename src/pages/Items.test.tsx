import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAnalytics, mockLogClick, mockOpenToast } from "@/__tests__/__helpers__/mocks";
import { BASE } from "@/test/fixtures";
import { OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";

mockTds();
mockAnalytics();

// navigate 호출은 기록하되 실제 라우터에도 그대로 흘려보낸다(재마운트 시 state가 비었는지 보려고).
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

// mocks.ts는 import되는 순간 자기 react-router-dom 목(useNavigate=mockNavigate, useLocation=mockLocation)을
// 호이스팅해 등록하므로, 위쪽에서 hoist된 vi.mock은 그 뒤에 덮어써진다. 그래서 헬퍼를 import한 **뒤에**
// 목을 다시 걸고 라우터를 쓰는 모듈은 그 뒤에 동적으로 불러온다.
vi.doMock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const react = await import("react");
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate();
      const ref = react.useRef(real);
      ref.current = real;
      return react.useCallback((...args: unknown[]) => {
        navigateSpy(...args);
        return (ref.current as (...a: unknown[]) => unknown)(...args);
      }, []);
    },
  };
});

// 저장 계층: 기본은 실제 saveOutflows, 실패 경로만 테스트에서 덮는다.
const { saveOutflowsSpy } = vi.hoisted(() => ({ saveOutflowsSpy: vi.fn() }));
vi.mock("@/lib/store/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/save")>();
  saveOutflowsSpy.mockImplementation(actual.saveOutflows);
  return { ...actual, saveOutflows: saveOutflowsSpy };
});

const { MemoryRouter, useLocation } = await import("react-router-dom");
const { AppDataProvider } = await import("@/state/AppDataContext");
const { default: Items } = await import("@/pages/Items");

const FAIL_MSG = "저장하지 못했어요. 다시 시도해주세요";

type Item = Record<string, unknown>;

function seed(items: readonly object[]) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items }));
}

function stored(): Item[] {
  return JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? "{}").items;
}

function LocationProbe() {
  const location = useLocation();
  return React.createElement("output", { "data-testid": "loc-state" }, JSON.stringify(location.state));
}

function Remountable() {
  const [n, setN] = React.useState(0);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("button", { type: "button", onClick: () => setN((v) => v + 1) }, "__remount"),
    React.createElement(Items, { key: n }),
  );
}

function renderItems(state?: unknown, element: React.ReactElement = React.createElement(Items)) {
  const entry = state === undefined ? "/items" : { pathname: "/items", state };
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      React.createElement(AppDataProvider, null, element, React.createElement(LocationProbe)),
    ),
  );
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fill(name: string, amount: string, day: string) {
  type(/이름/, name);
  type(/금액/, amount);
  type(/출금일/, day);
}

function openRow(name: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
}

function rowOrder(): string[] {
  return Array.from(document.querySelectorAll("li"))
    .map((li) => li.textContent ?? "")
    .map((text) => ["카드값", "넷플릭스", "통신비", "월세"].find((n) => text.startsWith(n)))
    .filter((n): n is string => Boolean(n));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  navigateSpy.mockClear();
  saveOutflowsSpy.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe("출금 항목 페이지 (/items) + 목록", () => {
  it("AC-1[P0]: 이름을 trim해 items 끝에 5개 키로 추가하고 시트를 닫은 뒤 Toast·로그를 남긴다", () => {
    seed([BASE.outflows[1], BASE.outflows[3]]);
    renderItems();

    fireEvent.click(screen.getByRole("button", { name: "출금 추가" }));
    fill("  월세  ", "550000", "24");
    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    const items = stored();
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual(BASE.outflows[1]);
    const added = items[2];
    expect(Object.keys(added).sort()).toEqual(["amount", "day", "id", "name", "weekendRule"]);
    expect(added).toMatchObject({ name: "월세", amount: 550000, day: 24, weekendRule: "none" });
    expect(typeof added.id).toBe("string");
    expect((added.id as string).length).toBeGreaterThanOrEqual(1);
    expect((added.id as string).length).toBeLessThanOrEqual(32);

    expect(screen.queryByRole("button", { name: "추가하기" })).toBeNull();
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("추가했어요");
    expect(mockLogClick).toHaveBeenCalledTimes(1);
    expect(mockLogClick).toHaveBeenCalledWith("outflow_add_submit");
  });

  it("AC-2[P0]: 행을 탭해 수정하면 같은 인덱스가 교체되고 나머지는 그대로다", () => {
    seed(BASE.outflows);
    renderItems();

    openRow("월세");
    expect((screen.getByLabelText(/이름/) as HTMLInputElement).value).toBe("월세");
    fill("월세(관리비 포함)", "600000", "26");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    const items = stored();
    expect(items[0]).toEqual({ id: "o-rent", name: "월세(관리비 포함)", amount: 600000, day: 26, weekendRule: "none" });
    expect(items.slice(1)).toEqual(BASE.outflows.slice(1));
    expect(mockOpenToast).toHaveBeenCalledWith("저장했어요");
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(screen.getByText("월세(관리비 포함)")).toBeInTheDocument();
  });

  it("AC-2·AC-12[P1]: 대기 중인 dayChange는 금액만 바꾸면 유지되고 날짜를 바꾸면 사라진다", () => {
    const card = {
      id: "o-card",
      name: "카드값",
      amount: 420000,
      day: 26,
      weekendRule: "none",
      dayChange: { fromDay: 10, effectiveMonth: "2026-11" },
    };
    seed([card]);
    renderItems();

    openRow("카드값");
    expect((screen.getByLabelText(/출금일/) as HTMLInputElement).value).toBe("26");
    type(/금액/, "450000");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    expect(stored()[0]).toEqual({ ...card, amount: 450000 });

    openRow("카드값");
    type(/출금일/, "10");
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    expect(stored()[0]).toEqual({ id: "o-card", name: "카드값", amount: 450000, day: 10, weekendRule: "none" });
    expect(localStorage.getItem(OUTFLOWS_KEY)).not.toContain("dayChange");
  });

  it("AC-3[P0]: 삭제는 확인 대화상자에서 '삭제'를 눌러야 반영되고 '닫기'는 유지한다", () => {
    seed(BASE.outflows);
    renderItems();

    openRow("넷플릭스");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "'넷플릭스' 항목을 삭제할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(stored()).toHaveLength(4);
    expect(mockOpenToast).toHaveBeenCalledTimes(0);

    // 닫은 뒤에도 수정 시트는 열려 있으니 같은 시트에서 다시 삭제를 진행한다.
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const again = screen.getByRole("alertdialog", { name: "'넷플릭스' 항목을 삭제할까요?" });
    fireEvent.click(within(again).getByRole("button", { name: "삭제" }));

    expect(stored().map((i) => i.id)).toEqual(["o-rent", "o-card", "o-phone"]);
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("삭제했어요");
  });

  it("AC-4[P1]: 0개면 아이콘·안내 문구·프리셋 칩 5개가 보이고 칩은 이름만 채운 시트를 연다", () => {
    seed([]);
    renderItems();

    expect(screen.getByText("아직 등록한 출금이 없어요")).toBeInTheDocument();
    expect(document.querySelector("[data-content-icon]")).not.toBeNull();
    const presets = ["월세", "카드값", "통신비", "보험료", "구독료"];
    for (const name of presets) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button").filter((b) => presets.includes(b.textContent ?? ""))).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "카드값" }));
    expect((screen.getByLabelText(/이름/) as HTMLInputElement).value).toBe("카드값");
    expect((screen.getByLabelText(/금액/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/출금일/) as HTMLInputElement).value).toBe("");
  });

  it("AC-6[P1]: 30개면 시트를 열지 않고 Toast만 띄우며 저장은 30개로 유지된다", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({
      id: `o-${i}`,
      name: `항목${i + 1}`,
      amount: 10000,
      day: (i % 28) + 1,
      weekendRule: "none",
    }));
    seed(thirty);
    renderItems();

    fireEvent.click(screen.getByRole("button", { name: "출금 추가" }));

    expect(screen.queryByRole("button", { name: "추가하기" })).toBeNull();
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith("출금 항목은 30개까지 등록할 수 있어요");
    expect(stored()).toHaveLength(30);
    expect(saveOutflowsSpy).toHaveBeenCalledTimes(0);
  });

  it("AC-7[P1]: day 오름차순으로 보여 주되 저장 순서와 쓰기는 건드리지 않고 합계 요약을 낸다", () => {
    seed(BASE.outflows);
    const before = localStorage.getItem(OUTFLOWS_KEY);
    renderItems();

    expect(rowOrder()).toEqual(["카드값", "넷플릭스", "통신비", "월세"]);
    expect(screen.getByTestId("outflow-total").textContent).toBe("매월 출금 합계 1,052,000원 · 월급의 42%");
    const bars = screen.getAllByRole("progressbar");
    expect(bars.some((bar) => bar.getAttribute("aria-valuenow") === "42")).toBe(true);

    expect(saveOutflowsSpy).toHaveBeenCalledTimes(0);
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(before);
    expect(stored().map((i) => i.id)).toEqual(["o-rent", "o-card", "o-phone", "o-netflix"]);
  });

  it.each([
    ["quota", "quota"],
    ["unknown", "unknown"],
  ] as const)("AC-8·AC-10[P1]: 저장이 %s로 실패하면 Toast를 띄우고 시트는 입력값을 쥔 채 열려 있다", (_label, error) => {
    seed(BASE.outflows);
    const before = localStorage.getItem(OUTFLOWS_KEY);
    renderItems();

    fireEvent.click(screen.getByRole("button", { name: "출금 추가" }));
    fill("보험료", "88000", "5");
    saveOutflowsSpy.mockImplementationOnce(() => ({ ok: false, error }));
    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));

    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith(FAIL_MSG);
    expect(mockOpenToast).not.toHaveBeenCalledWith("추가했어요");
    expect(mockLogClick).toHaveBeenCalledWith("outflow_add_submit");
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(before);
    expect(screen.getByRole("button", { name: "추가하기" })).toBeInTheDocument();
    expect((screen.getByLabelText(/이름/) as HTMLInputElement).value).toBe("보험료");
    expect((screen.getByLabelText(/금액/) as HTMLInputElement).value).toMatch(/^88,?000$/);
    expect((screen.getByLabelText(/출금일/) as HTMLInputElement).value).toBe("5");
  });

  it("AC-10[P1]: 삭제 저장이 실패하면 대화상자만 닫히고 수정 시트와 항목은 그대로다", () => {
    seed(BASE.outflows);
    renderItems();

    openRow("통신비");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "'통신비' 항목을 삭제할까요?" });
    saveOutflowsSpy.mockImplementationOnce(() => ({ ok: false, error: "unknown" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: "저장하기" })).toBeInTheDocument();
    expect(stored()).toHaveLength(4);
    expect(mockOpenToast).toHaveBeenCalledTimes(1);
    expect(mockOpenToast).toHaveBeenCalledWith(FAIL_MSG);
    expect(mockOpenToast).not.toHaveBeenCalledWith("삭제했어요");
  });

  it("AC-11[P2]: openAdd로 진입하면 시트를 열고 state를 비우며, 재마운트하면 시트가 닫혀 있다", () => {
    seed(BASE.outflows);
    renderItems({ from: "onboarding", openAdd: true }, React.createElement(Remountable));

    expect(screen.getByRole("button", { name: "추가하기" })).toBeInTheDocument();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(".", {
      replace: true,
      state: { from: "onboarding", openAdd: false },
    });
    expect(JSON.parse(screen.getByTestId("loc-state").textContent ?? "null")).toEqual({
      from: "onboarding",
      openAdd: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "__remount" }));
    expect(screen.queryByRole("button", { name: "추가하기" })).toBeNull();
    expect(stored()).toHaveLength(4);
    expect(mockOpenToast).toHaveBeenCalledTimes(0);
  });

  it("AC-11·AC-6[P2]: openAdd로 진입했는데 30개면 시트 대신 상한 Toast를 띄운다", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => ({
      id: `o-${i}`,
      name: `항목${i + 1}`,
      amount: 10000,
      day: (i % 28) + 1,
      weekendRule: "none",
    }));
    seed(thirty);
    renderItems({ openAdd: true });

    expect(screen.queryByRole("button", { name: "추가하기" })).toBeNull();
    expect(mockOpenToast).toHaveBeenCalledWith("출금 항목은 30개까지 등록할 수 있어요");
    expect(navigateSpy).toHaveBeenCalledWith(".", { replace: true, state: { openAdd: false } });
  });
});
