import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import {
  mockTds,
  mockAnalytics,
  mockLogClick,
  mockLogImpression,
  mockShareApp,
  mockOpenToast,
} from "@/__tests__/__helpers__/mocks";
import { BASE, BASE_TODAY } from "@/test/fixtures";
import { buildHomeModel } from "@/lib/balance/homeModel";
import type { HomeModel } from "@/lib/balance/homeModel";
import type { Outflow } from "@/lib/types";
import { ScheduleList } from "@/components/home/ScheduleList";
import { LowestDayCard } from "@/components/home/LowestDayCard";
import { ShareButton } from "@/components/home/ShareButton";

mockTds();
mockAnalytics();

const MGMT: Outflow = { id: "o-mgmt", name: "관리비", amount: 100000, day: 5, weekendRule: "none" };

function model(opts?: { month?: string; outflows?: Outflow[]; variant?: boolean }): HomeModel {
  const outflows = (opts?.outflows ?? BASE.outflows).map((o) =>
    opts?.variant && o.id === "o-rent" ? { ...o, weekendRule: "nextBusinessDay" as const } : o,
  );
  const settings = opts?.variant
    ? { ...BASE.settings, salaryWeekendRule: "prevBusinessDay" as const }
    : BASE.settings;
  return buildHomeModel({ settings, outflows, today: BASE_TODAY, month: opts?.month ?? "2026-10" });
}

function card(m: HomeModel, monthLabel: string, strict = false) {
  const el = React.createElement(
    MemoryRouter,
    null,
    React.createElement(LowestDayCard, { summary: m.summary, monthLabel, sparkline: m.sparkline }),
  );
  return render(strict ? React.createElement(React.StrictMode, null, el) : el);
}

// 노출 로그는 뷰포트 진입 시점에 — jsdom에는 IntersectionObserver가 없어 즉시 교차하는 스텁을 둔다.
class ImmediateIO {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  vi.stubGlobal("IntersectionObserver", ImmediateIO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("출금 일정 목록 + 최저 잔고일 카드 + 공유 버튼", () => {
  it("AC-1[P0]: BASE 5행이 SPEC 문자열과 정확히 같다", () => {
    const m = model();
    render(React.createElement(MemoryRouter, null, React.createElement(ScheduleList, { rows: m.rows })));
    const list = screen.getByTestId("schedule-list");

    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).getByText("10월 14일 (수) 카드값")).toBeInTheDocument();
    expect(within(list).getByText("-420,000원 · 잔고 380,000원")).toBeInTheDocument();
    expect(within(list).getByText("10월 18일 (일) 넷플릭스")).toBeInTheDocument();
    expect(within(list).getByText("-17,000원 · 잔고 363,000원")).toBeInTheDocument();
  });

  it("AC-1[P0]: 기준일 이전 관리비가 있으면 6행이고 첫 행은 '지남'이다", () => {
    const m = model({ outflows: [...BASE.outflows, MGMT] });
    render(React.createElement(MemoryRouter, null, React.createElement(ScheduleList, { rows: m.rows })));
    const items = within(screen.getByTestId("schedule-list")).getAllByRole("listitem");

    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText("10월 5일 (월) 관리비")).toBeInTheDocument();
    expect(within(items[0]).getByText("-100,000원 · 지남")).toBeInTheDocument();
    expect(items[0].textContent).not.toContain("잔고");
  });

  it("AC-2[P0]: BASE 10월 카드에 최저 잔고일·-252,000원·잔고 부족·부족 캡션이 보인다", () => {
    card(model(), "이번 달");

    expect(screen.getByText("이번 달 최저 잔고일 · 10월 24일 (토)")).toBeInTheDocument();
    expect(screen.getByText("-252,000원")).toBeInTheDocument();
    expect(screen.getByText("잔고 부족")).toBeInTheDocument();
    expect(screen.getByText("10월 24일부터 마이너스예요 · 252,000원 부족")).toBeInTheDocument();
  });

  it("AC-2[P0]: StrictMode에서도 logImpression('lowest_day_card')는 1회다", () => {
    card(model(), "이번 달", true);

    expect(mockLogImpression).toHaveBeenCalledTimes(1);
    expect(mockLogImpression).toHaveBeenCalledWith("lowest_day_card");
  });

  it("AC-3[P1]: 변형 설정이면 월급 전 최저 구간 2일과 298,000원이 보이고 Badge는 없다", () => {
    card(model({ variant: true }), "이번 달");

    expect(screen.getByText("월급 전 최저 구간 10월 21일 ~ 10월 22일 (2일)")).toBeInTheDocument();
    expect(screen.getByText("298,000원")).toBeInTheDocument();
    expect(screen.queryByText("잔고 부족")).toBeNull();
  });

  it("AC-3[P1]: 11월 카드는 '11월 최저 잔고일'과 1,196,000원, 하루 구간을 보여 준다", () => {
    card(model({ month: "2026-11" }), "11월");

    expect(screen.getByText("11월 최저 잔고일 · 11월 24일 (화)")).toBeInTheDocument();
    expect(screen.getByText("1,196,000원")).toBeInTheDocument();
    expect(screen.getByText("월급 전 최저 구간 11월 24일 하루")).toBeInTheDocument();
    expect(screen.queryByText("잔고 부족")).toBeNull();
  });

  it("AC-4[P2]: balance-sparkline은 점 21개이고 최저점 표시가 인덱스 13(10-24)에 있다", () => {
    const m = model();
    expect(m.sparkline.points).toHaveLength(21);
    expect(m.sparkline.minIndex).toBe(13);
    card(m, "이번 달");

    const svg = screen.getByTestId("balance-sparkline");
    const points = svg.querySelectorAll("[data-point-index]");
    const lowest = svg.querySelectorAll('[data-lowest="true"]');

    expect(points).toHaveLength(21);
    expect(lowest).toHaveLength(1);
    expect(lowest[0].getAttribute("data-point-index")).toBe("13");
  });

  it("AC-5[P1]: 공유 버튼을 탭하면 logClick('share_calendar')와 shareApp이 1회씩 호출된다", async () => {
    render(React.createElement(MemoryRouter, null, React.createElement(ShareButton)));
    fireEvent.click(screen.getByRole("button", { name: "내 잔고 달력 공유하기" }));

    await waitFor(() => expect(mockShareApp).toHaveBeenCalledTimes(1));
    expect(mockLogClick).toHaveBeenCalledTimes(1);
    expect(mockLogClick).toHaveBeenCalledWith("share_calendar");
    expect(mockOpenToast).not.toHaveBeenCalled();
  });

  it("AC-5[P1]: shareApp이 reject하면 Toast '공유하지 못했어요'를 띄우고 unhandled rejection은 없다", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    mockShareApp.mockRejectedValueOnce(new Error("bridge down"));

    render(React.createElement(MemoryRouter, null, React.createElement(ShareButton)));
    fireEvent.click(screen.getByRole("button", { name: "내 잔고 달력 공유하기" }));

    await waitFor(() => expect(mockOpenToast).toHaveBeenCalledTimes(1));
    const arg = mockOpenToast.mock.calls[0][0] as string | { text?: string };
    expect(typeof arg === "string" ? arg : arg.text).toBe("공유하지 못했어요");
    await new Promise((r) => setTimeout(r, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });
});
