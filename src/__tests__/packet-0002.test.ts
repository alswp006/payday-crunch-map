/**
 * 테스트 환경 + BASE 픽스처 + 전역 셋업 테스트 (Packet 0002).
 *
 * 이 패킷은 화면이 없으므로 TDS·react-router 목을 걸지 않는다(렌더하지 않는다).
 * 여기서 잡는 것은 세 가지다.
 * 1) jsdom 환경이 실제로 켜져 있다.
 * 2) src/test/fixtures.ts의 BASE 픽스처가 SPEC 값과 정확히 같다.
 * 3) 전역 셋업이 테스트 사이에 localStorage를 비우고, console.error 호출을 실패로 만든다.
 */
import { describe, it, expect } from "vitest";
import { BASE } from "@/test/fixtures";

describe("테스트 환경 + BASE 픽스처 + 전역 셋업", () => {
  it("AC-1[P0]: vitest가 jsdom 환경에서 돌고 document·window가 있다", () => {
    // jsdom 사용자 에이전트 문자열에는 "jsdom"이 들어 있다
    expect(navigator.userAgent).toContain("jsdom");
    expect(document.body.tagName).toBe("BODY");
    expect(window.localStorage).toBe(globalThis.localStorage);
  });

  it("AC-2[P0]: BASE.settings는 SPEC 값과 deep-equal이고 키는 6개다", () => {
    expect(BASE.settings).toEqual({
      version: 1,
      salaryAmount: 2500000,
      salaryDay: 25,
      salaryWeekendRule: "none",
      currentBalance: 800000,
      balanceAsOf: "2026-10-11",
    });
    expect(Object.keys(BASE.settings)).toHaveLength(6);
    expect(BASE.settings.version).toBe(1);
  });

  it("AC-3[P0]: BASE.outflows는 4개가 등록 순서대로 들어 있고 dayChange 키가 없다", () => {
    expect(BASE.outflows).toStrictEqual([
      { id: "o-rent", name: "월세", amount: 550000, day: 24, weekendRule: "none" },
      { id: "o-card", name: "카드값", amount: 420000, day: 14, weekendRule: "none" },
      { id: "o-phone", name: "통신비", amount: 65000, day: 21, weekendRule: "none" },
      { id: "o-netflix", name: "넷플릭스", amount: 17000, day: 18, weekendRule: "none" },
    ]);
    for (const item of BASE.outflows) {
      expect(Object.keys(item)).not.toContain("dayChange");
    }
  });

  it("AC-3[P0]: BASE.outflows의 금액 합계는 1,052,000이다", () => {
    const total = BASE.outflows.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(1052000);
    expect(BASE.outflows).toHaveLength(4);
  });

  it("AC-4[P0]: 테스트 A가 localStorage에 값을 남긴다", () => {
    localStorage.setItem("pcm.probe.v1", "leftover");
    expect(localStorage.getItem("pcm.probe.v1")).toBe("leftover");
    expect(localStorage.length).toBe(1);
  });

  it("AC-4[P0]: 앞 테스트가 남긴 localStorage는 다음 테스트 시작 시 비어 있다", () => {
    expect(localStorage.getItem("pcm.probe.v1")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("AC-4[P0]: 테스트 중 console.error가 호출되면 그 테스트는 실패한다(자가 검증)", () => {
    // 셋업의 console.error 가드는 호출 즉시 throw해야 한다(테스트 본문 안에서 실패가 발생하도록).
    // 가드가 없으면 toThrow가 실패하므로 이 테스트는 빨갛다.
    expect(() => {
      console.error("가드 자가 검증 — 이 줄에서 테스트가 실패해야 한다");
    }).toThrow();
  });
});
