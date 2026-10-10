/**
 * 저장소 어댑터 + save 계열 + probeStorage + id 생성 테스트 (Packet 0004).
 *
 * 순수 저장 로직만 다루므로 TDS·react-router·AppState 목을 걸지 않는다(렌더하지 않는다).
 * localStorage 실패는 Storage.prototype / window.localStorage를 가로채 재현한다.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { BASE } from "@/test/fixtures";
import type { Outflow, PaySettings, AppMeta } from "@/lib/types";
import { probeStorage } from "@/lib/store/storage";
import { saveSettings, saveOutflows, saveMeta } from "@/lib/store/save";
import { newId } from "@/lib/store/id";

const OUTFLOWS_KEY = "pcm.outflows.v1";
const SETTINGS_KEY = "pcm.settings.v1";
const META_KEY = "pcm.meta.v1";

const OLD_SETTINGS = '{"version":1,"salaryAmount":1000000}';
const OLD_OUTFLOWS = '{"version":1,"items":[]}';
const OLD_META = '{"version":1,"lastSeenMonth":"2026-09"}';

/** 세 키에 기존 값을 심어 둔다 — 실패 시 바뀌지 않아야 할 기준선 */
function seedAllKeys() {
  localStorage.setItem(SETTINGS_KEY, OLD_SETTINGS);
  localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);
  localStorage.setItem(META_KEY, OLD_META);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("저장소 어댑터 + save 계열 + probeStorage + id 생성", () => {
  it("AC-1[P0]: setItem이 QuotaExceededError(name 또는 code 22)를 던지면 saveOutflows는 quota를 돌려주고 기존 값을 유지한다", () => {
    localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);

    const byName = new DOMException("full", "QuotaExceededError");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw byName;
    });
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: "quota" });
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
  });

  it("AC-1[P0]: Firefox 구형 이름(NS_ERROR_DOM_QUOTA_REACHED)과 code 22도 quota로 분류한다", () => {
    localStorage.setItem(OUTFLOWS_KEY, OLD_OUTFLOWS);

    const firefoxErr = Object.assign(new Error("full"), { name: "NS_ERROR_DOM_QUOTA_REACHED" });
    const codeErr = Object.assign(new Error("full"), { code: 22 });

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw firefoxErr;
    });
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: "quota" });

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw codeErr;
    });
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: "quota" });
    expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
  });

  it("AC-2[P0]: SecurityError·일반 Error가 나도 세 save 모두 예외 없이 unknown을 돌려주고 세 키는 그대로다", () => {
    const settings: PaySettings = { ...BASE.settings, currentBalance: 0 };
    const meta: AppMeta = { version: 1, lastSeenMonth: "2026-10" };
    const errors = [new DOMException("denied", "SecurityError"), new Error("x")];

    for (const err of errors) {
      seedAllKeys();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw err;
      });

      expect(() => saveSettings(settings)).not.toThrow();
      expect(saveSettings(settings)).toEqual({ ok: false, error: "unknown" });
      expect(saveOutflows(BASE.outflows)).toEqual({ ok: false, error: "unknown" });
      expect(saveMeta(meta)).toEqual({ ok: false, error: "unknown" });

      expect(localStorage.getItem(SETTINGS_KEY)).toBe(OLD_SETTINGS);
      expect(localStorage.getItem(OUTFLOWS_KEY)).toBe(OLD_OUTFLOWS);
      expect(localStorage.getItem(META_KEY)).toBe(OLD_META);

      vi.restoreAllMocks();
    }
  });

  it("AC-3[P0]: window.localStorage getter나 getItem이 던지면 probeStorage는 false를 돌려주고 예외를 던지지 않는다", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");

    // 1) 접근 자체가 막힌 경우 (사생활 보호 모드·iframe 정책)
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      expect(() => probeStorage()).not.toThrow();
      expect(probeStorage()).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }

    // 2) 접근은 되는데 getItem이 실패하는 경우
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("x");
    });
    expect(() => probeStorage()).not.toThrow();
    expect(probeStorage()).toBe(false);
  });

  it("AC-4[P0]: saveOutflows는 { version: 1, items }로 저장하고 dayChange 없는 항목에 dayChange 키를 쓰지 않으며 정의되지 않은 추가 필드도 버린다", () => {
    expect(saveOutflows(BASE.outflows)).toEqual({ ok: true });

    const raw = localStorage.getItem(OUTFLOWS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ version: 1, items: BASE.outflows });
    expect((raw as string).split("dayChange")).toHaveLength(1);

    // 타입에 없는 필드는 직렬화하지 않는다 (검증은 하지 않음 — 값은 그대로 통과)
    const withExtra = [
      { ...BASE.outflows[0], memo: "관리비 포함" },
    ] as unknown as Outflow[];
    expect(saveOutflows(withExtra)).toEqual({ ok: true });
    const parsed = JSON.parse(localStorage.getItem(OUTFLOWS_KEY) as string);
    expect(parsed.items[0]).not.toHaveProperty("memo");
    expect(parsed.items[0].name).toBe("월세");
  });

  it("AC-4[P0]: saveSettings·saveMeta는 각자 키('pcm.settings.v1', 'pcm.meta.v1')에 타입 필드만 쓴다", () => {
    const settingsWithExtra = { ...BASE.settings, debugNote: "x" } as unknown as PaySettings;
    expect(saveSettings(settingsWithExtra)).toEqual({ ok: true });
    const settingsParsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) as string);
    expect(settingsParsed).toEqual(BASE.settings);
    expect(settingsParsed).not.toHaveProperty("debugNote");

    const meta: AppMeta = { version: 1, lastSeenMonth: "2026-10" };
    expect(saveMeta(meta)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(META_KEY) as string)).toEqual({
      version: 1,
      lastSeenMonth: "2026-10",
    });
  });

  it("AC-5[P1]: newId는 /^[0-9a-z]{1,32}$/에 맞고 1000회 호출해도 중복이 없으며 crypto.randomUUID를 쓰지 않는다", () => {
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID");

    const ids = Array.from({ length: 1000 }, () => newId());
    const pattern = /^[0-9a-z]{1,32}$/;

    expect(ids.every((id) => pattern.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(1000);
    expect(randomUUID).not.toHaveBeenCalled();
  });
});
