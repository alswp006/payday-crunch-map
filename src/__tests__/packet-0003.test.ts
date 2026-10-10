/**
 * 날짜·금액 포맷 유틸 테스트 (Packet 0003: getToday, localDate, format).
 *
 * 순수 함수만 다루므로 TDS·react-router 목을 걸지 않는다(렌더하지 않는다).
 * 날짜 기준은 고정 시계(2026-10-11)를 쓰고, getToday는 로컬 시각 생성자로 시계를 맞춘다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getToday } from "@/lib/date/getToday";
import {
  weekday,
  daysInMonth,
  addDays,
  addMonths,
  diffDays,
  isValidLocalDate,
  isValidYearMonth,
} from "@/lib/date/localDate";
import {
  formatWon,
  formatSignedWon,
  formatCompactWon,
  formatKoreanDate,
} from "@/lib/format";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T09:00:00+09:00"));
});

describe("날짜·금액 포맷 유틸 (getToday, localDate, format)", () => {
  it("AC-1[P0]: formatCompactWon은 만·억 단위 축약 규칙을 따른다", () => {
    expect(formatCompactWon(9800)).toBe("9,800");
    expect(formatCompactWon(380000)).toBe("38만");
    expect(formatCompactWon(-252000)).toBe("-25.2만");
    expect(formatCompactWon(2248000)).toBe("224.8만");
    expect(formatCompactWon(123000000)).toBe("1.2억");
    expect(formatCompactWon(3300000)).toBe("330만");
  });

  it("AC-2[P0]: formatWon·formatSignedWon·formatKoreanDate는 정확한 표시 문자열을 낸다", () => {
    expect(formatWon(2500000)).toBe("2,500,000");
    expect(formatSignedWon(-252000)).toBe("-252,000원");
    expect(formatSignedWon(550000)).toBe("+550,000원");
    expect(formatKoreanDate("2026-10-24")).toBe("10월 24일 (토)");
  });

  it("AC-2[P0]: 0원은 부호 없이 0으로 표시되고 음수 부호는 항상 '-'다", () => {
    expect(formatWon(0)).toBe("0");
    expect(formatSignedWon(0)).toBe("0원");
    expect(formatWon(-1000)).toBe("-1,000");
  });

  it("AC-3[P0]: 요일·말일·덧셈·월 덧셈·일수 차이가 연말·월말 경계에서도 맞다", () => {
    expect(weekday("2026-10-24")).toBe(6); // 토요일 (일=0)
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(diffDays("2026-10-11", "2026-12-13")).toBe(63);
  });

  it("AC-4[P0]: 존재하지 않는 날짜와 잘못된 연월은 거부하고 정상 값은 통과시킨다", () => {
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDate("2026-10-11")).toBe(true);
    expect(isValidYearMonth("2026-13")).toBe(false);
    expect(isValidYearMonth("2026-12")).toBe(true);
  });

  it("AC-5[P0]: getToday는 로컬 연·월·일로 YYYY-MM-DD를 만들고 0을 채운다", () => {
    expect(getToday()).toBe("2026-10-11");
    // 로컬 자정 직후 — UTC로 바꾸면 전날이 되는 시각이라도 로컬 날짜를 써야 한다
    vi.setSystemTime(new Date(2026, 0, 5, 0, 30));
    expect(getToday()).toBe("2026-01-05");
  });

  it("AC-5[P0]: 세 소스 파일에 금지된 API(toISOString·randomUUID·structuredClone·.at(·Object.hasOwn·Intl.Segmenter)가 없다", () => {
    const forbidden = [
      "toISOString",
      "crypto.randomUUID",
      "structuredClone",
      ".at(",
      "Object.hasOwn",
      "Intl.Segmenter",
    ];
    const files = [
      "src/lib/date/getToday.ts",
      "src/lib/date/localDate.ts",
      "src/lib/format.ts",
    ];
    const hits = files.flatMap((file) => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      return forbidden.filter((token) => src.includes(token)).map((token) => `${file}: ${token}`);
    });
    expect(hits).toEqual([]);
  });
});
