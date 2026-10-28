import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleRun } from "@/lib/timer";
import type { LocalRun } from "@/types/run";
import { device } from "./device";

const local: LocalRun = {
  segments: [{ id: "intro", name: "도입", durationSec: 60 }],
  run: { ...createIdleRun(), status: "running", startedAt: 1_000, rev: 1 },
  shareCode: "share-code",
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe("device storage", () => {
  it("saves, loads and clears isolated run keys without changing the run snapshot", () => {
    expect(device.loadRun("a")).toBeNull();
    device.saveRun("a", local);
    device.saveRun("b", { ...local, shareCode: null });
    expect(JSON.parse(localStorage.getItem("run:a")!)).toEqual(local);
    expect(device.loadRun("a")).toEqual(local);
    const loaded = device.loadRun("a")!;
    loaded.segments[0].name = "수정";
    expect(device.loadRun("a")).toEqual(local);
    device.clearRun("a");
    expect(device.loadRun("a")).toBeNull();
    expect(device.loadRun("b")).toEqual({ ...local, shareCode: null });
  });

  it.each(["{broken", "null", "{}", "[]", JSON.stringify({ ...local, run: { ...local.run, rev: -1 } }), JSON.stringify({ ...local, segments: [null] }), JSON.stringify({ ...local, shareCode: 1 }), JSON.stringify({ segments: [], run: createIdleRun() })])(
    "returns null for broken run storage %s", (raw) => {
      localStorage.setItem("run:a", raw);
      expect(device.loadRun("a")).toBeNull();
    },
  );

  it("stores nickname on the device and keeps a client id per tab across reloads", () => {
    expect(device.loadNickname()).toBeNull();
    device.saveNickname("발표자");
    expect(localStorage.getItem("nickname")).toBe("발표자");
    expect(device.loadNickname()).toBe("발표자");
    const id = device.getClientId();
    expect(id).toMatch(/^[\da-f-]{36}$/i);
    expect(sessionStorage.getItem("clientId")).toBe(id);
    expect(localStorage.getItem("clientId")).toBeNull();
    expect(device.getClientId()).toBe(id);
  });

  it("gives each tab of the same browser its own client id", () => {
    // 같은 브라우저의 탭들은 localStorage를 함께 쓰지만 sessionStorage는 탭마다 따로예요.
    localStorage.setItem("clientId", "shared-id");
    const first = device.getClientId();
    sessionStorage.clear();
    const second = device.getClientId();
    expect(first).not.toBe("shared-id");
    expect(second).not.toBe(first);
  });

  it("tracks admission separately for each share code", () => {
    expect(device.hasJoined("a")).toBe(false);
    device.markJoined("a");
    expect(device.hasJoined("a")).toBe(true);
    expect(device.hasJoined("b")).toBe(false);
  });

  it("swallows storage read, write and removal exceptions", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    }
    expect(device.loadRun("a")).toBeNull();
    expect(device.loadNickname()).toBeNull();
    expect(device.hasJoined("a")).toBe(false);
    expect(() => device.saveRun("a", local)).not.toThrow();
    expect(() => device.clearRun("a")).not.toThrow();
    expect(() => device.saveNickname("닉네임")).not.toThrow();
    expect(() => device.markJoined("a")).not.toThrow();
    expect(device.getClientId()).toMatch(/^[\da-f-]{36}$/i);
  });

  it("swallows exceptions accessing the storage properties themselves", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(device.loadRun("a")).toBeNull();
    expect(device.loadNickname()).toBeNull();
    expect(device.hasJoined("a")).toBe(false);
    expect(() => device.saveRun("a", local)).not.toThrow();
    expect(() => device.clearRun("a")).not.toThrow();
    expect(() => device.saveNickname("닉네임")).not.toThrow();
    expect(() => device.markJoined("a")).not.toThrow();
    expect(device.getClientId()).toMatch(/^[\da-f-]{36}$/i);
  });
});
