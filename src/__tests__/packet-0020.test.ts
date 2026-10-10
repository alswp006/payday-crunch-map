import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAnalytics, mockOpenToast, mockLogImpression } from "@/__tests__/__helpers__/mocks";
import { BASE } from "@/test/fixtures";
import { META_KEY, OUTFLOWS_KEY, SETTINGS_KEY } from "@/lib/store/keys";

mockTds();
mockAnalytics();

// mocks.ts가 호이스팅해 등록한 react-router-dom 목을 풀고 실제 라우터로 전체 App을 돌린다.
vi.doUnmock("react-router-dom");

const { MemoryRouter } = await import("react-router-dom");
const { default: App } = await import("@/App");

// ---------------------------------------------------------------- 정적 감사

const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** src/**\/*.{ts,tsx,css} 중 테스트 파일(*.test.*, src/test/**, src/__tests__/**)을 뺀 감사 대상. */
function auditTargets(): string[] {
  return walk(SRC).filter((file) => {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    if (!/\.(ts|tsx|css)$/.test(rel)) return false;
    if (/\.test\.[^/]+$/.test(rel)) return false;
    if (rel.startsWith("test/") || rel.startsWith("__tests__/")) return false;
    return true;
  });
}

/** 위반 위치를 `파일:줄  내용` 형태로 모은다 — 실패 메시지에서 바로 찾게 한다. */
function violations(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of auditTargets()) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (pattern.test(line)) found.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`);
      });
  }
  return found;
}

// ---------------------------------------------------------------- 화면 헬퍼

function renderAt(entry: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(App)),
  );
}

function seedBase() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(BASE.settings));
  localStorage.setItem(OUTFLOWS_KEY, JSON.stringify({ version: 1, items: BASE.outflows }));
  localStorage.setItem(META_KEY, JSON.stringify({ version: 1, lastSeenMonth: "2026-10" }));
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
  mockOpenToast.mockClear();
  mockLogImpression.mockClear();
  vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("최종 폴리시 — 검수 정적 감사 + 핵심 여정·리워드 게이트 통합 테스트", () => {
  it("AC-1[F4-AC-8]: 감사 대상이 실제로 있고 HEX·외부 이동·설치 유도 문자열이 0건이다", () => {
    expect(auditTargets().length).toBeGreaterThan(10);

    expect(violations(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
    expect(violations(/window\.open\(/)).toEqual([]);
    expect(violations(/location\.href = 'http/)).toEqual([]);
    expect(violations(/설치|다운로드/)).toEqual([]);
  });

  it("AC-2[F7-AC-7]: 구형 WebView 비호환 API와 외부 분석 SDK import가 0건이다", () => {
    expect(violations(/crypto\.randomUUID/)).toEqual([]);
    expect(violations(/structuredClone/)).toEqual([]);
    expect(violations(/\.at\(/)).toEqual([]);
    expect(violations(/Object\.hasOwn/)).toEqual([]);
    expect(violations(/Intl\.Segmenter/)).toEqual([]);
    expect(violations(/from\s+['"](react-ga|@amplitude[^'"]*|firebase\/analytics)['"]|require\(['"](react-ga|@amplitude[^'"]*|firebase\/analytics)['"]\)/)).toEqual([]);
  });

  it("AC-3[F4-AC-1, Value AC][P0]: 빈 저장소에서 setup → items → 달력 탭으로 가면 홈에 월세 -25.2만과 최저 -252,000원이 보인다", () => {
    renderAt("/setup");

    expect(screen.getByRole("heading", { name: "월급과 잔고를 알려주세요" })).toBeInTheDocument();
    type(/월급 실수령액/, "2500000");
    type(/월급일/, "25");
    type(/잔고/, "800000");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null")).toEqual(BASE.settings);
    expect(screen.getByRole("button", { name: "달력 보기" })).toBeInTheDocument();

    for (const item of BASE.outflows) {
      fireEvent.click(screen.getByRole("button", { name: "출금 추가" }));
      type(/이름/, item.name);
      type(/금액/, String(item.amount));
      type(/출금일/, String(item.day));
      fireEvent.click(screen.getByRole("button", { name: "추가하기" }));
    }
    const stored = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) ?? "{}").items as { name: string }[];
    expect(stored.map((o) => o.name)).toEqual(["월세", "카드값", "통신비", "넷플릭스"]);

    // 하단 '달력' 탭이 있으면 탭으로, 온보딩 CTA만 있으면 '달력 보기'로 홈에 간다.
    const tab = screen.queryByRole("tab", { name: "달력" });
    fireEvent.click(tab ?? screen.getByRole("button", { name: "달력 보기" }));

    const cell = screen.getByTestId("day-cell-2026-10-24");
    expect(within(cell).getByText("월세")).toBeInTheDocument();
    expect(within(cell).getByText("-25.2만")).toBeInTheDocument();
    expect(within(screen.getByTestId("lowest-day-card")).getByText("-252,000원")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("AC-4[F6-AC-1, F6-AC-13][P0]: 광고 슬롯이 비면 무료 층이 보이고 잠금 층 sim-row 4개가 자동으로 열린다", () => {
    seedBase();
    renderAt("/");

    const free = screen.getByTestId("free-tier");
    const lowest = within(free).getByTestId("lowest-day-card");
    expect(within(lowest).getByText(/10월 24일 \(토\)/)).toBeInTheDocument();
    expect(within(lowest).getByText("-252,000원")).toBeInTheDocument();
    expect(within(free).getAllByTestId("calendar-grid")).toHaveLength(1);
    expect(within(free).getAllByTestId("schedule-list")).toHaveLength(1);

    const locked = screen.getByTestId("locked-tier");
    expect(within(locked).getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(screen.queryByTestId("locked-teaser")).toBeNull();
  });

  it("AC-4[F6-AC-13]: 광고가 없어도 실패 Toast는 0개이고 sim_locked_tier 노출은 1회다", () => {
    seedBase();
    renderAt("/");

    expect(screen.getAllByTestId(/^sim-row-/)).toHaveLength(4);
    expect(mockOpenToast).not.toHaveBeenCalled();
    const lockedLogs = mockLogImpression.mock.calls.filter((c) => c[0] === "sim_locked_tier");
    expect(lockedLogs).toHaveLength(1);
    expect(lockedLogs[0]).toEqual(["sim_locked_tier"]);
  });

  it("AC-5: 핵심 화면 세 곳이 렌더 중 console.error 없이 그려진다", () => {
    seedBase();
    for (const p of ["/", "/items", "/setup"]) {
      const view = renderAt(p);
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
      view.unmount();
    }
    expect(consoleError).toHaveBeenCalledTimes(0);
    expect(mockOpenToast).toHaveBeenCalledTimes(0);
  });
});
