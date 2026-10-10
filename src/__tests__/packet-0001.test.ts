/**
 * 도메인 타입 + RouteState 계약 테스트 (Packet 0001).
 *
 * 타입은 런타임에 사라지므로 여기서 잡는 것은 두 가지다.
 * 1) expectTypeOf / @ts-expect-error — `npx tsc --noEmit`이 필드 이름·옵셔널 여부·리터럴 값을 강제한다.
 * 2) 모듈 네임스페이스 — 두 파일에 런타임 export(const·function·class·enum)가 0개인지 확인한다.
 *    파일이 아직 없으면 import 자체가 실패하므로 red 단계에서 빨개진다.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  WeekendRule,
  LocalDate,
  YearMonth,
  PaySettings,
  OutflowStore,
  Outflow,
  AppMeta,
  DayEvent,
  DayBalance,
  MonthSummary,
  SimResult,
  SaveResult,
} from "@/lib/types";
import type { SetupRouteState, ItemsRouteState } from "@/types/nav";
import * as typesModule from "@/lib/types";
import * as navModule from "@/types/nav";

describe("도메인 타입 + RouteState 계약 정의", () => {
  it("AC-1[P0]: WeekendRule은 세 값으로 닫힌 집합이고 LocalDate·YearMonth는 문자열이다", () => {
    expectTypeOf<WeekendRule>().toEqualTypeOf<"none" | "prevBusinessDay" | "nextBusinessDay">();
    expectTypeOf<LocalDate>().toEqualTypeOf<string>();
    expectTypeOf<YearMonth>().toEqualTypeOf<string>();

    const rules: WeekendRule[] = ["none", "prevBusinessDay", "nextBusinessDay"];
    expect(rules).toHaveLength(3);
    // @ts-expect-error 닫힌 집합 밖의 값은 거부된다
    const invalid: WeekendRule = "weekend";
    expect(invalid).toBe("weekend");
  });

  it("AC-1[P0]: PaySettings는 SPEC 필드 6개와 version 리터럴 1을 가지고 updatedAt이 없다", () => {
    expectTypeOf<PaySettings>().toEqualTypeOf<{
      version: 1;
      salaryAmount: number;
      salaryDay: number;
      salaryWeekendRule: WeekendRule;
      currentBalance: number;
      balanceAsOf: LocalDate;
    }>();
    expectTypeOf<PaySettings>().not.toHaveProperty("updatedAt");

    const settings: PaySettings = {
      version: 1,
      salaryAmount: 2500000,
      salaryDay: 25,
      salaryWeekendRule: "none",
      currentBalance: 800000,
      balanceAsOf: "2026-10-11",
    };
    expect(settings.salaryAmount).toBe(2500000);
    expect(settings.balanceAsOf).toBe("2026-10-11");
  });

  it("AC-1[P0]: OutflowStore·Outflow는 SPEC 모양과 같고 dayChange만 옵셔널이며 createdAt이 없다", () => {
    expectTypeOf<OutflowStore>().toEqualTypeOf<{ version: 1; items: Outflow[] }>();
    expectTypeOf<Outflow>().toEqualTypeOf<{
      id: string;
      name: string;
      amount: number;
      day: number;
      weekendRule: WeekendRule;
      dayChange?: { fromDay: number; effectiveMonth: YearMonth };
    }>();
    expectTypeOf<Outflow>().not.toHaveProperty("createdAt");

    const item: Outflow = { id: "o-rent", name: "월세", amount: 550000, day: 24, weekendRule: "none" };
    const store: OutflowStore = { version: 1, items: [item] };
    expect(store.items[0].dayChange).toBeUndefined();
    expect(store.items).toEqual([item]);
  });

  it("AC-1[P0]: AppMeta는 version 1과 lastSeenMonth(YearMonth | null)만 가진다", () => {
    expectTypeOf<AppMeta>().toEqualTypeOf<{ version: 1; lastSeenMonth: YearMonth | null }>();

    const meta: AppMeta = { version: 1, lastSeenMonth: null };
    // @ts-expect-error version은 리터럴 1만 허용된다
    const wrongVersion: AppMeta = { version: 2, lastSeenMonth: null };
    expect(meta.lastSeenMonth).toBeNull();
    expect(wrongVersion.version).toBe(2);
  });

  it("AC-1[P1]: 파생 타입 DayEvent·DayBalance·MonthSummary·SimResult는 SPEC 필드와 1:1이다", () => {
    expectTypeOf<DayEvent>().toEqualTypeOf<{
      kind: "salary" | "outflow";
      refId: string | null;
      name: string;
      amount: number;
      scheduledDay: number;
      actualDate: LocalDate;
      shifted: boolean;
    }>();
    expectTypeOf<DayBalance>().toEqualTypeOf<{
      date: LocalDate;
      events: DayEvent[];
      lowBalance: number;
      endBalance: number;
    }>();
    expectTypeOf<MonthSummary>().toEqualTypeOf<{
      month: YearMonth;
      lowest: { date: LocalDate; balance: number } | null;
      crunch: { start: LocalDate; end: LocalDate; days: number } | null;
      firstNegativeDate: LocalDate | null;
    }>();
    expectTypeOf<SimResult>().toEqualTypeOf<{
      itemId: string;
      name: string;
      fromDay: number;
      toDay: number;
      baseMin: number;
      newMin: number;
      delta: number;
      improved: boolean;
    }>();

    const day: DayBalance = { date: "2026-10-24", events: [], lowBalance: 1200000, endBalance: 1200000 };
    expect(day.events).toHaveLength(0);
    expect(day.lowBalance).toBe(1200000);
  });

  it("AC-2[P0]: SaveResult는 성공 또는 quota·unknown 실패 중 하나다", () => {
    expectTypeOf<SaveResult>().toEqualTypeOf<{ ok: true } | { ok: false; error: "quota" | "unknown" }>();

    const ok: SaveResult = { ok: true };
    const quota: SaveResult = { ok: false, error: "quota" };
    // @ts-expect-error 정의되지 않은 error 코드는 거부된다
    const invalid: SaveResult = { ok: false, error: "validation" };
    expect(ok.ok).toBe(true);
    expect(quota).toEqual({ ok: false, error: "quota" });
    expect(invalid).toEqual({ ok: false, error: "validation" });
  });

  it("AC-3[P0]: nav.ts의 SetupRouteState·ItemsRouteState가 SPEC 모양과 같다", () => {
    expectTypeOf<SetupRouteState>().toEqualTypeOf<{ mode: "onboarding" | "edit"; focus?: "balance" }>();
    expectTypeOf<ItemsRouteState>().toEqualTypeOf<{ from?: "onboarding"; openAdd?: boolean }>();

    const setup: SetupRouteState = { mode: "onboarding" };
    const items: ItemsRouteState = { from: "onboarding", openAdd: true };
    // @ts-expect-error mode는 onboarding | edit만 허용된다
    const badMode: SetupRouteState = { mode: "create" };
    expect(setup.mode).toBe("onboarding");
    expect(items).toEqual({ from: "onboarding", openAdd: true });
    expect(badMode.mode).toBe("create");
  });

  it("AC-4[P0]: 두 파일에는 런타임 export가 하나도 없다(type/interface만)", () => {
    expect(Object.keys(typesModule)).toEqual([]);
    expect(Object.keys(navModule)).toEqual([]);
  });
});
